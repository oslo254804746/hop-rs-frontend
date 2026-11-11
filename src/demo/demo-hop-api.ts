import {
  DEMO_HOP_API_CAPABILITIES,
  type AccessKey,
  type Asset,
  type AssetWriteInput,
  type Credential,
  type CredentialWriteInput,
  type HopApi,
  type RequestOptions,
} from '@/domain'
import { HopApiError } from '@/api/errors'

import { createDemoFixtures, type DemoFixtures } from './fixtures'

export interface DemoHopApiOptions {
  fixtures?: DemoFixtures
}

export function createDemoHopApi(options: DemoHopApiOptions = {}): HopApi {
  const state = clone(options.fixtures ?? createDemoFixtures())
  let nextId = 1

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

  function simulateProbe(asset: Asset): Asset {
    const now = demoNow()
    if (asset.id === 'asset-router-ui' || asset.hostname.endsWith('.254')) {
      asset.health = {
        status: 'failed',
        checkedAt: now,
        lastSuccessAt: asset.health?.status === 'healthy' ? asset.health.lastSuccessAt : null,
        errorCode: 'tcp_connect_failed',
        errorMessage: `connect ${asset.hostname}:${asset.port}: connection refused`,
      }
      return asset
    }
    const baseSeed = [...asset.hostname].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const latencyMs = asset.hostname.startsWith('192.168.')
      ? (baseSeed % 5) + 2
      : (baseSeed % 48) + 9
    asset.health = {
      status: 'healthy',
      checkedAt: now,
      lastSuccessAt: now,
      latencyMs,
    }
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
      const now = demoNow()
      const asset: Asset = {
        id: `asset-demo-${nextId++}`,
        name: input.name,
        protocol: input.protocol,
        hostname: input.hostname,
        port: input.port,
        displayName: input.displayName?.trim() || null,
        description: input.description ?? null,
        tags: input.tags ?? [],
        credentialId: input.protocol === 'ssh' ? (input.credentialId ?? null) : null,
        createdAt: now,
        updatedAt: now,
        management: { mode: 'local' },
        health: { status: 'unknown', checkedAt: null },
      }
      state.assets.push(asset)
      incrementRevision()
      recordAudit('asset.create', 'asset', asset.id, asset.name, {
        protocol: asset.protocol,
        hostname: asset.hostname,
        port: asset.port,
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
        credentialId: input.protocol === 'ssh' ? (input.credentialId ?? null) : null,
        updatedAt: demoNow(),
      }
      state.assets[index] = updated
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
      state.assets.splice(index, 1)
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
