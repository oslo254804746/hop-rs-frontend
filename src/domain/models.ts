export type Timestamp = string

export type AssetProtocol = 'ssh' | 'tcp'
export type CredentialAuthType = 'password' | 'key' | 'key_passphrase'
export type SecretStatus = 'configured' | 'missing'
export type AccessMode = 'all' | 'restricted'

export type ResourceManagement =
  | { mode: 'local' }
  | { mode: 'config'; sourceId?: string; sourceKey?: string }

export type AssetHealth =
  | {
      status: 'unknown'
      checkedAt: Timestamp | null
    }
  | {
      status: 'healthy'
      checkedAt: Timestamp | null
      lastSuccessAt: Timestamp | null
      latencyMs: number | null
    }
  | {
      status: 'failed'
      checkedAt: Timestamp | null
      lastSuccessAt: Timestamp | null
      errorCode: string | null
      errorMessage: string | null
    }

export interface InstanceStatus {
  status: 'ok'
  version: string
  catalogRevision: number
}

export interface Asset {
  id: string
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  description: string | null
  tags: string[]
  credentialId: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  management?: ResourceManagement
  health?: AssetHealth
}

export interface AssetWriteInput {
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  description?: string | null
  tags?: string[]
  credentialId?: string | null
}

export interface Credential {
  id: string
  name: string
  username: string
  authType: CredentialAuthType
  password: SecretStatus
  privateKey: SecretStatus
  passphrase: SecretStatus
  management?: ResourceManagement
}

export interface CredentialWriteInput {
  name: string
  username: string
  authType: CredentialAuthType
  password?: string | null
  privateKey?: string | null
  passphrase?: string | null
}

export interface AccessKey {
  id: string
  name: string
  fingerprint: string
  enabled: boolean
  accessMode: AccessMode
  /** `null` means all assets; an empty array is an explicit deny-all scope. */
  assetIds: string[] | null
  management?: ResourceManagement
}

export interface AccessKeyCreateInput {
  name: string
  publicKey: string
  /** `null` or omitted means all assets; an empty array means deny all. */
  assetIds?: string[] | null
}

export interface Session {
  id: string
  keyFingerprint: string
  keyName: string | null
  mode: string
  assetName: string | null
  targetHost: string | null
  targetPort: number | null
  clientIp: string | null
  status: string
  error: string | null
  startedAt: Timestamp | null
  endedAt: Timestamp | null
}

export interface TerminateSessionResult {
  id: string
  terminated: boolean
}

export interface ConfigSourceStatus {
  sourceId: string
  generation: number
  lastSuccessAt: Timestamp | null
  lastSuccessRevision: number | null
  lastErrorAt: Timestamp | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
}

export interface OrphanStatus {
  resourceType: string
  sourceId: string
  sourceKey: string
  orphanedAt: Timestamp
}

export interface CatalogStatus {
  revision: number
  manifestApiVersion: string
  sources: ConfigSourceStatus[]
  orphans: OrphanStatus[]
}

export type ManifestFormat = 'yaml' | 'toml'

export interface ManifestInput {
  content: string
  format: ManifestFormat
}

export interface ValidateManifestInput extends ManifestInput {
  offline?: boolean
}

export interface ValidationResult {
  valid: true
  offline: boolean
}

export interface DiffManifestInput extends ManifestInput {
  sourceId: string
  prune?: boolean
}

export interface ApplyManifestInput extends ManifestInput {
  sourceId: string
  baseRevision: number
  prune?: boolean
  dryRun?: boolean
}

export type ApplyAction = 'created' | 'updated' | 'deleted' | 'orphaned' | 'unchanged'

export interface ApplyChange {
  resourceType: string
  name: string
  action: ApplyAction
}

export interface ApplySummary {
  sourceId: string
  baseRevision: number
  newRevision: number
  generation: number
  dryRun: boolean
  created: number
  updated: number
  deleted: number
  orphaned: number
  unchanged: number
  changes: ApplyChange[]
}

export interface ReloadResult {
  applied: ApplySummary[]
}
