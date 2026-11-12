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
      consecutiveFailures?: number
      alertFiring?: boolean
    }
  | {
      status: 'healthy'
      checkedAt: Timestamp | null
      lastSuccessAt: Timestamp | null
      latencyMs: number | null
      consecutiveFailures?: number
      alertFiring?: boolean
    }
  | {
      status: 'failed'
      checkedAt: Timestamp | null
      lastSuccessAt: Timestamp | null
      errorCode: string | null
      errorMessage: string | null
      consecutiveFailures?: number
      alertFiring?: boolean
    }

export interface InstanceStatus {
  status: 'ok'
  version: string
  catalogRevision: number
  sshListen?: string
}

export interface Asset {
  id: string
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  displayName?: string | null
  description: string | null
  tags: string[]
  credentialId: string | null
  viaAssetId?: string | null
  viaAssetName?: string | null
  allowTcpForwarding?: boolean
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
  displayName?: string | null
  description?: string | null
  tags?: string[]
  credentialId?: string | null
  viaAssetId?: string | null
  allowTcpForwarding?: boolean
}

export interface AssetProbeSample {
  id: number
  assetId: string
  checkedAt: Timestamp
  status: 'healthy' | 'failed' | 'unknown' | string
  latencyMs: number | null
  errorCode: string | null
}

export interface BootstrapKeyInput {
  username?: string | null
  password?: string | null
  credentialName?: string | null
  disablePasswordAuth?: boolean
  prunePreviousCredential?: boolean
}

export interface BootstrapKeyResult {
  asset: Asset
  credential: Credential
  publicKey: string
  publicKeyFingerprint: string
  verifiedKeyLogin: boolean
  prunedPreviousCredential: boolean
  passwordAuthDisabled: boolean
  warnings: string[]
}

export interface ProbeSettings {
  enabled: boolean
  intervalSeconds: number
  timeoutMs: number
  failureThreshold: number
  notifyOnRecovery: boolean
  updatedAt: Timestamp | null
}

export interface ProbeSettingsWriteInput {
  enabled: boolean
  intervalSeconds: number
  timeoutMs: number
  failureThreshold: number
  notifyOnRecovery: boolean
}

export type NotificationChannelKind = 'telegram' | 'bark' | 'webhook'

export interface NotificationConfigSummary {
  chatId?: string | null
  apiBaseUrl?: string | null
  serverUrl?: string | null
  url?: string | null
  hasSecret: boolean
}

export interface NotificationConfigInput {
  botToken?: string | null
  chatId?: string | null
  apiBaseUrl?: string | null
  serverUrl?: string | null
  deviceKey?: string | null
  url?: string | null
  secret?: string | null
}

export interface NotificationChannel {
  id: string
  name: string
  kind: NotificationChannelKind
  enabled: boolean
  config: NotificationConfigSummary
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface NotificationChannelWriteInput {
  name: string
  kind: NotificationChannelKind
  enabled: boolean
  config: NotificationConfigInput
}

export interface NotificationTestResult {
  delivered: boolean
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

export interface KnownHost {
  hostname: string
  port: number
  keyType: string
  fingerprint: string
  firstSeen: Timestamp | null
}

export interface KnownHostIdentity {
  hostname: string
  port: number
  keyType: string
}

export interface AuditEvent {
  id: string
  occurredAt: Timestamp | null
  actorLabel: string
  action: string
  targetType: string
  targetId: string | null
  targetLabel: string | null
  result: string
  sourceIp: string | null
  detailsJson: string | null
}
