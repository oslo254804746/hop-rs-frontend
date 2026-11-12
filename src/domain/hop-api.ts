import type {
  AccessKey,
  AccessKeyCreateInput,
  Asset,
  AssetProbeSample,
  AssetWriteInput,
  AuditEvent,
  BootstrapKeyInput,
  BootstrapKeyResult,
  Credential,
  CredentialWriteInput,
  InstanceStatus,
  KnownHost,
  KnownHostIdentity,
  NotificationChannel,
  NotificationChannelWriteInput,
  NotificationTestResult,
  ProbeSettings,
  ProbeSettingsWriteInput,
  Session,
  TerminateSessionResult,
} from './models'

export type HopApiMode = 'remote' | 'demo'

export interface HopApiCapabilities {
  /** Whether list responses expose local/declarative ownership metadata. */
  ownership: boolean
  /** Whether assets include observed reachability/latency state and on-demand probing. */
  assetHealth: boolean
  /** Whether control-plane audit events are exposed via the API. */
  auditEvents: boolean
}

export const REMOTE_HOP_API_CAPABILITIES: Readonly<HopApiCapabilities> = Object.freeze({
  ownership: true,
  assetHealth: true,
  auditEvents: true,
})

export const DEMO_HOP_API_CAPABILITIES: Readonly<HopApiCapabilities> = Object.freeze({
  ownership: true,
  assetHealth: true,
  auditEvents: true,
})

export interface RequestOptions {
  signal?: AbortSignal
}

export interface HopApi {
  readonly mode: HopApiMode
  readonly capabilities: Readonly<HopApiCapabilities>

  getStatus(options?: RequestOptions): Promise<InstanceStatus>
  getRevision(options?: RequestOptions): Promise<number>

  listAssets(options?: RequestOptions): Promise<Asset[]>
  createAsset(input: AssetWriteInput, options?: RequestOptions): Promise<Asset>
  updateAsset(id: string, input: AssetWriteInput, options?: RequestOptions): Promise<Asset>
  deleteAsset(id: string, options?: RequestOptions): Promise<void>
  probeAssets(options?: RequestOptions): Promise<Asset[]>
  probeAsset(id: string, options?: RequestOptions): Promise<Asset>
  bootstrapAssetKey(
    id: string,
    input: BootstrapKeyInput,
    options?: RequestOptions,
  ): Promise<BootstrapKeyResult>
  getAllProbeHistory(
    limit?: number,
    options?: RequestOptions,
  ): Promise<Record<string, AssetProbeSample[]>>
  getAssetProbeHistory(
    id: string,
    limit?: number,
    options?: RequestOptions,
  ): Promise<AssetProbeSample[]>

  getProbeSettings(options?: RequestOptions): Promise<ProbeSettings>
  updateProbeSettings(
    input: ProbeSettingsWriteInput,
    options?: RequestOptions,
  ): Promise<ProbeSettings>

  listNotificationChannels(options?: RequestOptions): Promise<NotificationChannel[]>
  createNotificationChannel(
    input: NotificationChannelWriteInput,
    options?: RequestOptions,
  ): Promise<NotificationChannel>
  updateNotificationChannel(
    id: string,
    input: NotificationChannelWriteInput,
    options?: RequestOptions,
  ): Promise<NotificationChannel>
  deleteNotificationChannel(id: string, options?: RequestOptions): Promise<void>
  testNotificationChannel(id: string, options?: RequestOptions): Promise<NotificationTestResult>

  listCredentials(options?: RequestOptions): Promise<Credential[]>
  createCredential(input: CredentialWriteInput, options?: RequestOptions): Promise<Credential>
  updateCredential(
    id: string,
    input: CredentialWriteInput,
    options?: RequestOptions,
  ): Promise<Credential>
  deleteCredential(id: string, options?: RequestOptions): Promise<void>

  listAccessKeys(options?: RequestOptions): Promise<AccessKey[]>
  createAccessKey(input: AccessKeyCreateInput, options?: RequestOptions): Promise<AccessKey>
  setAccessKeyEnabled(
    id: string,
    enabled: boolean,
    options?: RequestOptions,
  ): Promise<AccessKey>
  setAccessKeyAccess(
    id: string,
    assetIds: string[] | null,
    options?: RequestOptions,
  ): Promise<AccessKey>
  deleteAccessKey(id: string, options?: RequestOptions): Promise<void>

  listSessions(options?: RequestOptions): Promise<Session[]>
  terminateSession(id: string, options?: RequestOptions): Promise<TerminateSessionResult>

  listKnownHosts(options?: RequestOptions): Promise<KnownHost[]>
  resetKnownHost(identity: KnownHostIdentity, options?: RequestOptions): Promise<void>

  listAuditEvents(options?: RequestOptions): Promise<AuditEvent[]>
}
