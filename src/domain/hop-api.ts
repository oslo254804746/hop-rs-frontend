import type {
  AccessKey,
  AccessKeyCreateInput,
  ApplyManifestInput,
  ApplySummary,
  Asset,
  AssetWriteInput,
  Credential,
  CredentialWriteInput,
  DiffManifestInput,
  InstanceStatus,
  KnownHost,
  KnownHostIdentity,
  Session,
  TerminateSessionResult,
  ValidateManifestInput,
  ValidationResult,
} from './models'

export type HopApiMode = 'remote' | 'demo'

export interface HopApiCapabilities {
  /** Whether list responses expose local/declarative ownership metadata. */
  ownership: boolean
  /** Whether assets include observed reachability/latency state. */
  assetHealth: boolean
}

export const REMOTE_HOP_API_CAPABILITIES: Readonly<HopApiCapabilities> = Object.freeze({
  ownership: true,
  assetHealth: false,
})

export const DEMO_HOP_API_CAPABILITIES: Readonly<HopApiCapabilities> = Object.freeze({
  ownership: true,
  assetHealth: true,
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

  validateManifest(
    input: ValidateManifestInput,
    options?: RequestOptions,
  ): Promise<ValidationResult>
  diffManifest(input: DiffManifestInput, options?: RequestOptions): Promise<ApplySummary>
  applyManifest(input: ApplyManifestInput, options?: RequestOptions): Promise<ApplySummary>
}
