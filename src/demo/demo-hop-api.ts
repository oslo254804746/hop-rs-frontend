import {
  DEMO_HOP_API_CAPABILITIES,
  type AccessKey,
  type ApplyChange,
  type ApplyManifestInput,
  type ApplySummary,
  type Asset,
  type AssetWriteInput,
  type ConfigSourceStatus,
  type Credential,
  type CredentialWriteInput,
  type DiffManifestInput,
  type HopApi,
  type RequestOptions,
  type ValidateManifestInput,
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
    state.configStatus.revision = state.status.catalogRevision
  }

  function requireLocal(
    resource: { management?: Asset['management'] } | undefined,
    resourceType: string,
    id: string,
  ): void {
    if (resource === undefined) {
      throw apiError(422, 'validation_failed', `unknown ${resourceType} id: ${id}`)
    }
    if (resource.management?.mode === 'declarative') {
      throw apiError(
        409,
        'managed_by_source',
        `managed_by_source: resource is managed by ${resource.management.sourceId}`,
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

  function manifestChanges(content: string): ApplyChange[] {
    if (content.trim() === '') return []
    return [
      { resourceType: 'asset', name: 'edge-router', action: 'updated' },
      { resourceType: 'access_key', name: 'ci-deploy', action: 'unchanged' },
    ]
  }

  function applySummary(
    input: DiffManifestInput | ApplyManifestInput,
    dryRun: boolean,
  ): ApplySummary {
    const changes = manifestChanges(input.content)
    const updated = changes.filter((change) => change.action === 'updated').length
    const unchanged = changes.filter((change) => change.action === 'unchanged').length
    const changed = changes.some((change) => change.action !== 'unchanged')
    const source = state.configStatus.sources.find((item) => item.sourceId === input.sourceId)

    return {
      sourceId: input.sourceId,
      baseRevision: state.status.catalogRevision,
      newRevision: state.status.catalogRevision + Number(changed),
      generation: (source?.generation ?? 0) + Number(changed),
      dryRun,
      created: 0,
      updated,
      deleted: 0,
      orphaned: 0,
      unchanged,
      changes,
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
        description: input.description ?? null,
        tags: input.tags ?? [],
        credentialId: input.protocol === 'ssh' ? (input.credentialId ?? null) : null,
        updatedAt: demoNow(),
      }
      state.assets[index] = updated
      incrementRevision()
      return clone(updated)
    },

    async deleteAsset(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.assets.findIndex((item) => item.id === id)
      requireLocal(state.assets[index], 'asset', id)
      state.assets.splice(index, 1)
      for (const key of state.accessKeys) {
        if (key.assetIds !== null) key.assetIds = key.assetIds.filter((assetId) => assetId !== id)
      }
      incrementRevision()
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
      return clone(credential)
    },

    async deleteCredential(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.credentials.findIndex((item) => item.id === id)
      requireLocal(state.credentials[index], 'credential', id)
      if (state.assets.some((asset) => asset.credentialId === id)) {
        throw apiError(
          409,
          'catalog_conflict',
          'catalog write conflicted with an existing or referenced resource',
        )
      }
      state.credentials.splice(index, 1)
      incrementRevision()
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
      return clone(key!)
    },

    async deleteAccessKey(id, requestOptions) {
      checkRequest(requestOptions)
      const index = state.accessKeys.findIndex((item) => item.id === id)
      requireLocal(state.accessKeys[index], 'access_key', id)
      state.accessKeys.splice(index, 1)
      incrementRevision()
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
      }
      return { id, terminated }
    },

    async listConfigSources(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.configStatus.sources)
    },

    async getConfigStatus(requestOptions) {
      checkRequest(requestOptions)
      return clone(state.configStatus)
    },

    async validateManifest(input, requestOptions) {
      checkRequest(requestOptions)
      validateManifest(input)
      return { valid: true, offline: input.offline ?? false }
    },

    async diffManifest(input, requestOptions) {
      checkRequest(requestOptions)
      validateManifest(input)
      return applySummary(input, true)
    },

    async applyManifest(input, requestOptions) {
      checkRequest(requestOptions)
      validateManifest(input)
      if (input.baseRevision !== state.status.catalogRevision) {
        throw new HopApiError(
          `base revision ${input.baseRevision} does not match current revision ${state.status.catalogRevision}`,
          {
            kind: 'http',
            code: 'revision_conflict',
            status: 409,
            path: 'catalog_revision',
          },
        )
      }
      const summary = applySummary(input, input.dryRun ?? false)
      if (!summary.dryRun && summary.newRevision !== summary.baseRevision) {
        state.status.catalogRevision = summary.newRevision
        state.configStatus.revision = summary.newRevision
        upsertSuccessfulSource(state, input.sourceId, summary)
      }
      return clone(summary)
    },

    async reloadConfig(requestOptions) {
      checkRequest(requestOptions)
      const source = state.configStatus.sources[1] ?? state.configStatus.sources[0]
      if (source === undefined) return { applied: [] }
      const baseRevision = state.status.catalogRevision
      incrementRevision()
      source.generation += 1
      source.lastSuccessAt = demoNow()
      source.lastSuccessRevision = state.status.catalogRevision
      source.lastErrorAt = null
      source.lastErrorCode = null
      source.lastErrorMessage = null
      return {
        applied: [
          {
            sourceId: source.sourceId,
            baseRevision,
            newRevision: state.status.catalogRevision,
            generation: source.generation,
            dryRun: false,
            created: 0,
            updated: 1,
            deleted: 0,
            orphaned: 0,
            unchanged: 1,
            changes: [
              { resourceType: 'asset', name: 'edge-router', action: 'updated' },
              { resourceType: 'access_key', name: 'ci-deploy', action: 'unchanged' },
            ],
          },
        ],
      }
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

function validateManifest(input: ValidateManifestInput): void {
  if (!input.content.includes('api_version')) {
    throw apiError(500, 'apply_failed', 'invalid manifest syntax or field type')
  }
  if (!input.content.includes('hop/v1alpha1')) {
    throw new HopApiError('unsupported api_version; expected hop/v1alpha1', {
      kind: 'http',
      code: 'unsupported_api_version',
      status: 422,
      path: 'api_version',
    })
  }
}

function upsertSuccessfulSource(
  state: DemoFixtures,
  sourceId: string,
  summary: ApplySummary,
): void {
  let source: ConfigSourceStatus | undefined = state.configStatus.sources.find(
    (item) => item.sourceId === sourceId,
  )
  if (source === undefined) {
    source = {
      sourceId,
      generation: summary.generation,
      lastSuccessAt: demoNow(),
      lastSuccessRevision: summary.newRevision,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    }
    state.configStatus.sources.push(source)
    return
  }
  source.generation = summary.generation
  source.lastSuccessAt = demoNow()
  source.lastSuccessRevision = summary.newRevision
  source.lastErrorAt = null
  source.lastErrorCode = null
  source.lastErrorMessage = null
}
