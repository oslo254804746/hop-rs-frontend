import {
  DEMO_HOP_API_CAPABILITIES,
  type AccessKey,
  type Asset,
  type AssetProbeSample,
  type AssetWriteInput,
  type BootstrapKeyInput,
  type BootstrapKeyResult,
  type Credential,
  type CredentialWriteInput,
  type HopApi,
  type NotificationChannel,
  type NotificationChannelWriteInput,
  type ProbeSettings,
  type ProbeSettingsWriteInput,
  type RequestOptions,
} from '@/domain'
import { HopApiError } from '@/api/errors'

import { createDemoFixtures, type DemoFixtures } from './fixtures'

export interface DemoHopApiOptions {
  fixtures?: DemoFixtures
}

export function createDemoHopApi(options: DemoHopApiOptions = {}): HopApi {
  const baseFixtures = options.fixtures ?? createDemoFixtures()
  const state = clone({
    ...baseFixtures,
    probeHistory: baseFixtures.probeHistory ?? {},
    probeSettings: baseFixtures.probeSettings ?? {
      enabled: false,
      intervalSeconds: 300,
      timeoutMs: 4000,
      failureThreshold: 2,
      notifyOnRecovery: true,
      updatedAt: null,
    },
    notificationChannels: baseFixtures.notificationChannels ?? [],
  })
  let nextId = 1
  let nextSampleId = 1000

  function checkRequest(optionsForRequest?: RequestOptions): void {
    if (optionsForRequest?.signal?.aborted) {
      throw new HopApiError('The request was cancelled.', {
        kind: 'aborted',
        code: 'request_aborted',
        status: null,
      })
    }
  }

  function incrementRevision(): void {
    state.status.catalogRevision += 1
  }

  function recordAudit(
    action: string,
    targetType: string,
    targetId: string | null,
    targetLabel: string | null,
    details?: Record<string, unknown>,
  ): void {
    state.auditEvents.unshift({
      id: `audit-demo-live-${nextId++}`,
      occurredAt: demoNow(),
      actorLabel: 'demo-operator',
      action,
      targetType,
      targetId,
      targetLabel,
      result: 'success',
      sourceIp: null,
      detailsJson: details ? JSON.stringify(details) : null,
    })
  }

  function appendProbeSample(assetId: string, sample: Omit<AssetProbeSample, 'id' | 'assetId'>): void {
    const list = state.probeHistory[assetId] ?? []
    list.push({
      id: nextSampleId++,
      assetId,
      ...sample,
    })
    if (list.length > 96) {
      list.splice(0, list.length - 96)
    }
    state.probeHistory[assetId] = list
  }

  function simulateProbe(asset: Asset): Asset {
    const now = demoNow()
    const prevFailures = asset.health?.consecutiveFailures ?? 0
    if (asset.id === 'asset-router-ui' || asset.hostname.endsWith('.254')) {
      const consecutiveFailures = prevFailures + 1
      const alertFiring =
        asset.health?.alertFiring === true ||
        consecutiveFailures >= state.probeSettings.failureThreshold
      asset.health = {
        status: 'failed',
        checkedAt: now,
        lastSuccessAt: asset.health?.status === 'healthy' ? asset.health.lastSuccessAt : null,
        errorCode: 'tcp_connect_failed',
        errorMessage: `connect ${asset.hostname}:${asset.port}: connection refused`,
        consecutiveFailures,
        alertFiring,
      }
      appendProbeSample(asset.id, {
        checkedAt: now,
        status: 'failed',
        latencyMs: null,
        errorCode: 'tcp_connect_failed',
      })
      return asset
    }
    const baseSeed = [...asset.hostname].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const hopPenalty = asset.viaAssetId ? 85 : 0
    const latencyMs =
      (asset.hostname.startsWith('192.168.') ? (baseSeed % 5) + 2 : (baseSeed % 48) + 9) +
      hopPenalty
    asset.health = {
      status: 'healthy',
      checkedAt: now,
      lastSuccessAt: now,
      latencyMs,
      consecutiveFailures: 0,
      alertFiring: false,
    }
    appendProbeSample(asset.id, {
      checkedAt: now,
      status: 'healthy',
      latencyMs,
      errorCode: null,
    })
    return asset
  }

  function requireLocal(
    resource: { management?: Asset['management'] } | undefined,
    resourceType: string,
    id: string,
  ): void {
    if (resource === undefined) {
      throw apiError(422, 'validation_failed', `unknown ${resourceType} id: ${id}`)
    }
    if (resource.management?.mode === 'config') {
      throw apiError(
        409,
        'managed_by_source',
        'managed_by_source: resource is managed by the startup configuration',
      )
    }
  }

  function assertUniqueName(
    collection: Array<{ id: string; name: string }>,
    name: string,
    currentId?: string,
  ): void {
    if (collection.some((item) => item.name === name && item.id !== currentId)) {
      throw apiError(
        409,
        'catalog_conflict',
        'catalog write conflicted with an existing or referenced resource',
      )
    }
  }

  function resolveAndValidateViaAsset(
    targetId: string,
    viaAssetId: string | null | undefined,
  ): { viaAssetId: string | null; viaAssetName: string | null } {
    const normalized = viaAssetId?.trim() || null
    if (!normalized) {
      return { viaAssetId: null, viaAssetName: null }
    }
    if (normalized === targetId) {
      throw apiError(422, 'validation_failed', 'via_asset chain contains a cycle')
    }
    const seen = new Set<string>([targetId])
    let curId: string | null = normalized
    let hops = 0
    while (curId) {
      hops += 1
      if (hops > 4) {
        throw apiError(
          422,
          'validation_failed',
          'via_asset chain exceeds maximum depth of 4 hops',
        )
      }
      if (seen.has(curId)) {
        throw apiError(422, 'validation_failed', 'via_asset chain contains a cycle')
      }
      seen.add(curId)
      const parent = state.assets.find((item) => item.id === curId)
      if (!parent) {
        throw apiError(422, 'validation_failed', `unknown via_asset_id ${curId}`)
      }
      if (parent.protocol !== 'ssh' || !parent.credentialId) {
        throw apiError(
          422,
          'validation_failed',
          `via_asset ${parent.name} must be a managed SSH asset with a credential`,
        )
      }
      curId = parent.viaAssetId ?? null
    }
    const directParent = state.assets.find((item) => item.id === normalized)!
    return { viaAssetId: normalized, viaAssetName: directParent.name }
  }

  function validateAssetInput(input: AssetWriteInput): void {
    if (input.name.trim() === '' || input.hostname.trim() === '') {
      throw apiError(422, 'validation_failed', 'name and hostname are required')
    }
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65_535) {
      throw apiError(422, 'validation_failed', `tcp port must be between 1 and 65535, got ${input.port}`)
    }
  }

  function buildCredential(
    id: string,
    input: CredentialWriteInput,
    existing?: Credential,
  ): Credential {
    const keepsKey = existing !== undefined && existing.authType !== 'password'
    const keepsPassphrase = existing?.authType === 'key_passphrase'
    const keepsPassword = existing?.authType === 'password'
    const hasPassword = hasSecret(input.password) || keepsPassword
    const hasPrivateKey = hasSecret(input.privateKey) || keepsKey
    const hasPassphrase = hasSecret(input.passphrase) || keepsPassphrase

    if (input.authType === 'password' && !hasPassword) {
      throw apiError(422, 'validation_failed', 'password auth requires a password')
    }
    if (input.authType === 'key' && !hasPrivateKey) {
      throw apiError(422, 'validation_failed', 'key auth requires a private key')
    }
    if (input.authType === 'key_passphrase' && (!hasPrivateKey || !hasPassphrase)) {
      throw apiError(
        422,
        'validation_failed',
        'key+passphrase auth requires a private key and passphrase',
      )
    }

    return {
      id,
      name: input.name,
      username: input.username,
      authType: input.authType,
      password: input.authType === 'password' ? 'configured' : 'missing',
      privateKey: input.authType === 'password' ? 'missing' : 'configured',
      passphrase: input.authType === 'key_passphrase' ? 'configured' : 'missing',
      ...(existing?.management !== undefined ? { management: existing.management } : {}),
    }
  }

  function buildNotificationChannel(
    id: string,
    input: NotificationChannelWriteInput,
    existing?: NotificationChannel,
  ): NotificationChannel {
    const name = input.name.trim()
    if (!name) {
      throw apiError(422, 'validation_failed', 'notification channel name must not be empty')
    }
    const now = demoNow()
    if (input.kind === 'telegram') {
      const chatId = input.config.chatId?.trim() || existing?.config.chatId || ''
      const hasToken =
        hasSecret(input.config.botToken) ||
        (existing?.kind === 'telegram' && existing.config.hasSecret)
      if (!chatId || !hasToken) {
        throw apiError(422, 'validation_failed', 'telegram channel requires bot_token and chat_id')
      }
      const apiBaseUrl = input.config.apiBaseUrl?.trim() || undefined
      return {
        id,
        name,
        kind: 'telegram',
        enabled: input.enabled,
        config: {
          chatId,
          ...(apiBaseUrl ? { apiBaseUrl } : {}),
          hasSecret: true,
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
    }
    if (input.kind === 'bark') {
      const hasKey =
        hasSecret(input.config.deviceKey) ||
        (existing?.kind === 'bark' && existing.config.hasSecret)
      if (!hasKey) {
        throw apiError(422, 'validation_failed', 'bark channel requires device_key')
      }
      const serverUrl = input.config.serverUrl?.trim() || 'https://api.day.app'
      return {
        id,
        name,
        kind: 'bark',
        enabled: input.enabled,
        config: {
          serverUrl,
          hasSecret: true,
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
    }
    const url = input.config.url?.trim() || existing?.config.url || ''
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw apiError(422, 'validation_failed', 'webhook channel requires http:// or https:// url')
    }
    const hasWebhookSecret =
      hasSecret(input.config.secret) ||
      (existing?.kind === 'webhook' && existing.config.hasSecret && input.config.secret === undefined)
    return {
      id,
      name,
      kind: 'webhook',
      enabled: input.enabled,
      config: {
        url,
        hasSecret: hasWebhookSecret,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
  }

  return {
    mode: 'demo',
    capabilities: DEMO_HOP_API_CAPABILITIES,

    async getStatus(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.status)
    },

    async getRevision(requestOptions) {
      checkRequest(requestOptions)
      return state.status.catalogRevision
    },

    async listAssets(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.assets)
    },

    async createAsset(input, requestOptions) {
      checkRequest(requestOptions)
      validateAssetInput(input)
      assertUniqueName(state.assets, input.name)
      const id = `asset-demo-${nextId++}`
      const { viaAssetId, viaAssetName } = resolveAndValidateViaAsset(id, input.viaAssetId)
      const now = demoNow()
      const asset: Asset = {
        id,
        name: input.name,
        protocol: input.protocol,
        hostname: input.hostname,
        port: input.port,
        displayName: input.displayName?.trim() || null,
        description: input.description ?? null,
        tags: input.tags ?? [],
        credentialId: input.protocol === 'ssh' ? (input.credentialId ?? null) : null,
        viaAssetId,
        viaAssetName,
        allowTcpForwarding: input.protocol === 'ssh' ? (input.allowTcpForwarding ?? true) : true,
        createdAt: now,
        updatedAt: now,
        management: { mode: 'local' },
        health: { status: 'unknown', checkedAt: null, consecutiveFailures: 0, alertFiring: false },
      }
      state.assets.push(asset)
      incrementRevision()
      recordAudit('asset.create', 'asset', asset.id, asset.name, {
        protocol: asset.protocol,
        hostname: asset.hostname,
        port: asset.port,
        ...(viaAssetName ? { via_asset: viaAssetName } : {}),
      })
      return clone(asset)
    },

    async updateAsset(id, input, requestOptions) {
      checkRequest(requestOptions)
      validateAssetInput(input)
      const index = state.assets.findIndex((item) => item.id === id)
      const existing = state.assets[index]
      requireLocal(existing, 'asset', id)
      assertUniqueName(state.assets, input.name, id)
      const nextCredentialId = input.protocol === 'ssh' ? (input.credentialId ?? null) : null
      if (
        (input.protocol !== 'ssh' || !nextCredentialId) &&
        state.assets.some((child) => child.viaAssetId === id)
      ) {
        throw apiError(
          422,
          'validation_failed',
          `asset ${input.name} is referenced as via_asset and must remain a managed SSH asset`,
        )
      }
      const nextViaInput =
        input.viaAssetId !== undefined ? input.viaAssetId : existing!.viaAssetId
      const { viaAssetId, viaAssetName } = resolveAndValidateViaAsset(id, nextViaInput)
      const updated: Asset = {
        ...existing!,
        name: input.name,
        protocol: input.protocol,
        hostname: input.hostname,
        port: input.port,
        displayName:
          input.displayName !== undefined
            ? (input.displayName?.trim() || null)
            : (existing!.displayName ?? null),
        description: input.description ?? null,
        tags: input.tags ?? [],
        credentialId: nextCredentialId,
        viaAssetId,
        viaAssetName,
        allowTcpForwarding:
          input.protocol === 'ssh'
            ? (input.allowTcpForwarding ?? existing!.allowTcpForwarding ?? true)
            : true,
        updatedAt: demoNow(),
      }
      state.assets[index] = updated
      for (const child of state.assets) {
        if (child.viaAssetId === updated.id) {
          child.viaAssetName = updated.name
        }
      }
      incrementRevision()
      recordAudit('asset.update', 'asset', updated.id, updated.name, {
        protocol: updated.protocol,
        hostname: updated.hostname,
        port: updated.port,
      })
      return clone(updated)
    },

    async deleteAsset(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.assets.findIndex((item) => item.id === id)
      const existing = state.assets[index]
      requireLocal(existing, 'asset', id)
      if (state.assets.some((item) => item.viaAssetId === id)) {
        throw apiError(
          409,
          'catalog_conflict',
          'catalog write conflicted with an existing or referenced resource',
        )
      }
      state.assets.splice(index, 1)
      delete state.probeHistory[id]
      for (const key of state.accessKeys) {
        if (key.assetIds !== null) key.assetIds = key.assetIds.filter((assetId) => assetId !== id)
      }
      incrementRevision()
      recordAudit('asset.delete', 'asset', id, existing?.name ?? id)
    },

    async probeAssets(requestOptions) {
      checkRequest(requestOptions)
      for (const asset of state.assets) {
        simulateProbe(asset)
      }
      const healthy = state.assets.filter((asset) => asset.health?.status === 'healthy').length
      const failed = state.assets.filter((asset) => asset.health?.status === 'failed').length
      recordAudit('asset.probe_all', 'asset', null, 'all', {
        total: state.assets.length,
        healthy,
        failed,
      })
      return clone(state.assets)
    },

    async probeAsset(id, requestOptions) {
      checkRequest(requestOptions)
      const asset = state.assets.find((item) => item.id === id)
      if (!asset) throw apiError(404, 'not_found', 'resource not found')
      simulateProbe(asset)
      recordAudit('asset.probe', 'asset', asset.id, asset.name, {
        status: asset.health?.status ?? 'unknown',
        latency_ms: asset.health?.status === 'healthy' ? asset.health.latencyMs : null,
      })
      return clone(asset)
    },

    async bootstrapAssetKey(
      id: string,
      input: BootstrapKeyInput,
      requestOptions?: RequestOptions,
    ): Promise<BootstrapKeyResult> {
      checkRequest(requestOptions)
      const asset = state.assets.find((item) => item.id === id)
      if (!asset) throw apiError(404, 'not_found', 'resource not found')
      requireLocal(asset, 'asset', id)
      if (asset.protocol !== 'ssh') {
        throw apiError(422, 'validation_failed', 'only ssh assets support SSH key bootstrap')
      }
      const existingCred = asset.credentialId
        ? state.credentials.find((item) => item.id === asset.credentialId)
        : undefined
      const username = input.username?.trim() || existingCred?.username || ''
      if (!username) {
        throw apiError(
          422,
          'validation_failed',
          'username is required when asset has no bound credential',
        )
      }
      if (!hasSecret(input.password) && !existingCred) {
        throw apiError(
          422,
          'validation_failed',
          'password is required when asset has no bound credential',
        )
      }
      const baseCredName = input.credentialName?.trim() || `${asset.name}-ed25519`
      const credName = state.credentials.some((c) => c.name === baseCredName)
        ? `${baseCredName}-${nextId}`
        : baseCredName
      const newCred: Credential = {
        id: `credential-demo-${nextId++}`,
        name: credName,
        username,
        authType: 'key',
        password: 'missing',
        privateKey: 'configured',
        passphrase: 'missing',
        management: { mode: 'local' },
      }
      state.credentials.unshift(newCred)

      const previousCredId = asset.credentialId
      asset.credentialId = newCred.id
      asset.updatedAt = demoNow()

      let prunedPreviousCredential = false
      if (
        input.prunePreviousCredential !== false &&
        previousCredId &&
        previousCredId !== newCred.id
      ) {
        const prevIndex = state.credentials.findIndex((c) => c.id === previousCredId)
        const prevCred = state.credentials[prevIndex]
        const stillUsed = state.assets.some((a) => a.credentialId === previousCredId)
        if (prevCred && prevCred.management?.mode === 'local' && !stillUsed) {
          state.credentials.splice(prevIndex, 1)
          prunedPreviousCredential = true
        }
      }

      simulateProbe(asset)
      incrementRevision()
      const fingerprint = `SHA256:Ed25519HopBootstrap${nextId}Kx9Qv4`
      const publicKey = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoBootstrapKey${nextId}HopManaged hop-managed:${asset.name}`
      const passwordAuthDisabled = Boolean(input.disablePasswordAuth)
      recordAudit('asset.bootstrap_key', 'asset', asset.id, asset.name, {
        credential_id: newCred.id,
        fingerprint,
        pruned_previous_credential: prunedPreviousCredential,
        password_auth_disabled: passwordAuthDisabled,
      })

      return {
        asset: clone(asset),
        credential: clone(newCred),
        publicKey,
        publicKeyFingerprint: fingerprint,
        verifiedKeyLogin: true,
        prunedPreviousCredential,
        passwordAuthDisabled,
        warnings: [],
      }
    },

    async getAllProbeHistory(limit = 24, requestOptions) {
      checkRequest(requestOptions)
      const clamped = Math.max(1, Math.min(96, Math.trunc(limit)))
      const result: Record<string, AssetProbeSample[]> = {}
      for (const [assetId, samples] of Object.entries(state.probeHistory)) {
        result[assetId] = clone(samples.slice(-clamped))
      }
      return result
    },

    async getAssetProbeHistory(id, limit = 48, requestOptions) {
      checkRequest(requestOptions)
      if (!state.assets.some((item) => item.id === id)) {
        throw apiError(404, 'not_found', 'resource not found')
      }
      const clamped = Math.max(1, Math.min(96, Math.trunc(limit)))
      return clone((state.probeHistory[id] ?? []).slice(-clamped))
    },

    async getProbeSettings(requestOptions): Promise<ProbeSettings> {
      checkRequest(requestOptions)
      return clone(state.probeSettings)
    },

    async updateProbeSettings(
      input: ProbeSettingsWriteInput,
      requestOptions?: RequestOptions,
    ): Promise<ProbeSettings> {
      checkRequest(requestOptions)
      if (input.intervalSeconds < 30 || input.intervalSeconds > 86_400) {
        throw apiError(
          422,
          'validation_failed',
          'probe interval_seconds must be between 30 and 86400',
        )
      }
      if (input.timeoutMs < 500 || input.timeoutMs > 15_000) {
        throw apiError(422, 'validation_failed', 'probe timeout_ms must be between 500 and 15000')
      }
      if (input.failureThreshold < 1 || input.failureThreshold > 10) {
        throw apiError(
          422,
          'validation_failed',
          'probe failure_threshold must be between 1 and 10',
        )
      }
      state.probeSettings = {
        enabled: input.enabled,
        intervalSeconds: Math.trunc(input.intervalSeconds),
        timeoutMs: Math.trunc(input.timeoutMs),
        failureThreshold: Math.trunc(input.failureThreshold),
        notifyOnRecovery: input.notifyOnRecovery,
        updatedAt: demoNow(),
      }
      recordAudit('probe.settings_update', 'probe_settings', 'singleton', 'probe-scheduler', {
        enabled: state.probeSettings.enabled,
        interval_seconds: state.probeSettings.intervalSeconds,
        failure_threshold: state.probeSettings.failureThreshold,
      })
      return clone(state.probeSettings)
    },

    async listNotificationChannels(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.notificationChannels)
    },

    async createNotificationChannel(input, requestOptions) {
      checkRequest(requestOptions)
      assertUniqueName(state.notificationChannels, input.name.trim())
      const channel = buildNotificationChannel(`channel-demo-${nextId++}`, input)
      state.notificationChannels.push(channel)
      recordAudit(
        'notification_channel.create',
        'notification_channel',
        channel.id,
        channel.name,
        { kind: channel.kind, enabled: channel.enabled },
      )
      return clone(channel)
    },

    async updateNotificationChannel(id, input, requestOptions) {
      checkRequest(requestOptions)
      const index = state.notificationChannels.findIndex((item) => item.id === id)
      const existing = state.notificationChannels[index]
      if (!existing) throw apiError(404, 'not_found', 'resource not found')
      assertUniqueName(state.notificationChannels, input.name.trim(), id)
      const updated = buildNotificationChannel(id, input, existing)
      state.notificationChannels[index] = updated
      recordAudit(
        'notification_channel.update',
        'notification_channel',
        updated.id,
        updated.name,
        { kind: updated.kind, enabled: updated.enabled },
      )
      return clone(updated)
    },

    async deleteNotificationChannel(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.notificationChannels.findIndex((item) => item.id === id)
      const existing = state.notificationChannels[index]
      if (!existing) throw apiError(404, 'not_found', 'resource not found')
      state.notificationChannels.splice(index, 1)
      recordAudit('notification_channel.delete', 'notification_channel', id, existing.name)
    },

    async testNotificationChannel(id, requestOptions) {
      checkRequest(requestOptions)
      const existing = state.notificationChannels.find((item) => item.id === id)
      if (!existing) throw apiError(404, 'not_found', 'resource not found')
      recordAudit('notification_channel.test', 'notification_channel', existing.id, existing.name, {
        kind: existing.kind,
      })
      return { delivered: true }
    },

    async listCredentials(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.credentials)
    },

    async createCredential(input, requestOptions) {
      checkRequest(requestOptions)
      assertUniqueName(state.credentials, input.name)
      const credential = buildCredential(`credential-demo-${nextId++}`, input)
      credential.management = { mode: 'local' }
      state.credentials.push(credential)
      incrementRevision()
      recordAudit('credential.create', 'credential', credential.id, credential.name, {
        username: credential.username,
        auth_type: credential.authType,
      })
      return clone(credential)
    },

    async updateCredential(id, input, requestOptions) {
      checkRequest(requestOptions)
      const index = state.credentials.findIndex((item) => item.id === id)
      const existing = state.credentials[index]
      requireLocal(existing, 'credential', id)
      assertUniqueName(state.credentials, input.name, id)
      const credential = buildCredential(id, input, existing)
      state.credentials[index] = credential
      incrementRevision()
      recordAudit('credential.update', 'credential', credential.id, credential.name, {
        username: credential.username,
        auth_type: credential.authType,
      })
      return clone(credential)
    },

    async deleteCredential(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.credentials.findIndex((item) => item.id === id)
      const existing = state.credentials[index]
      requireLocal(existing, 'credential', id)
      if (state.assets.some((asset) => asset.credentialId === id)) {
        throw apiError(
          409,
          'catalog_conflict',
          'catalog write conflicted with an existing or referenced resource',
        )
      }
      state.credentials.splice(index, 1)
      incrementRevision()
      recordAudit('credential.delete', 'credential', id, existing?.name ?? id)
    },

    async listAccessKeys(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.accessKeys)
    },

    async createAccessKey(input, requestOptions) {
      checkRequest(requestOptions)
      assertUniqueName(state.accessKeys, input.name)
      validateAssetIds(state, input.assetIds)
      const accessKey: AccessKey = {
        id: `access-demo-${nextId++}`,
        name: input.name,
        fingerprint: `SHA256:demo-${nextId}`,
        enabled: true,
        accessMode: input.assetIds === undefined || input.assetIds === null ? 'all' : 'restricted',
        assetIds: input.assetIds === undefined ? null : clone(input.assetIds),
        management: { mode: 'local' },
      }
      state.accessKeys.unshift(accessKey)
      incrementRevision()
      recordAudit('access_key.create', 'access_key', accessKey.id, accessKey.name, {
        fingerprint: accessKey.fingerprint,
        access_mode: accessKey.accessMode,
      })
      return clone(accessKey)
    },

    async setAccessKeyEnabled(id, enabled, requestOptions) {
      checkRequest(requestOptions)
      const key = state.accessKeys.find((item) => item.id === id)
      requireLocal(key, 'access_key', id)
      if (key!.enabled !== enabled) {
        key!.enabled = enabled
        incrementRevision()
      }
      recordAudit('access_key.set_enabled', 'access_key', key!.id, key!.name, { enabled })
      return clone(key!)
    },

    async setAccessKeyAccess(id, assetIds, requestOptions) {
      checkRequest(requestOptions)
      const key = state.accessKeys.find((item) => item.id === id)
      requireLocal(key, 'access_key', id)
      validateAssetIds(state, assetIds)
      key!.accessMode = assetIds === null ? 'all' : 'restricted'
      key!.assetIds = assetIds === null ? null : [...new Set(assetIds)].sort()
      incrementRevision()
      recordAudit('access_key.set_access', 'access_key', key!.id, key!.name, {
        access_mode: key!.accessMode,
      })
      return clone(key!)
    },

    async deleteAccessKey(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.accessKeys.findIndex((item) => item.id === id)
      const existing = state.accessKeys[index]
      requireLocal(existing, 'access_key', id)
      state.accessKeys.splice(index, 1)
      incrementRevision()
      recordAudit('access_key.delete', 'access_key', id, existing?.name ?? id)
    },

    async listSessions(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.sessions)
    },

    async terminateSession(id, requestOptions) {
      checkRequest(requestOptions)
      const session = state.sessions.find((item) => item.id === id)
      const terminated = session?.status === 'started'
      if (terminated && session !== undefined) {
        session.status = 'terminated'
        session.error = 'terminated by control API'
        session.endedAt = demoNow()
        recordAudit('session.terminate', 'session', id, session.assetName ?? id)
      }
      return { id, terminated }
    },

    async listKnownHosts(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.knownHosts)
    },

    async resetKnownHost(identity, requestOptions) {
      checkRequest(requestOptions)
      const index = state.knownHosts.findIndex(
        (host) =>
          host.hostname === identity.hostname &&
          host.port === identity.port &&
          host.keyType === identity.keyType,
      )
      if (index < 0) throw apiError(404, 'not_found', 'resource not found')
      state.knownHosts.splice(index, 1)
      recordAudit(
        'known_host.reset',
        'known_host',
        null,
        `${identity.hostname}:${identity.port} (${identity.keyType})`,
      )
    },

    async listAuditEvents(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.auditEvents)
    },
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function hasSecret(value: string | null | undefined): boolean {
  return value?.trim() !== '' && value != null
}

function apiError(status: number, code: string, message: string): HopApiError {
  return new HopApiError(message, { kind: 'http', code, status })
}

function demoNow(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
}

function validateAssetIds(state: DemoFixtures, assetIds: string[] | null | undefined): void {
  if (assetIds == null) return
  for (const id of new Set(assetIds)) {
    if (!state.assets.some((asset) => asset.id === id)) {
      throw apiError(422, 'validation_failed', `unknown asset id: ${id}`)
    }
  }
}
