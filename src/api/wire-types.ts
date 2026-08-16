import type {
  AccessMode,
  ApplyAction,
  AssetProtocol,
  ManifestFormat,
  SecretStatus,
} from '@/domain'

import type { WireCredentialAuthType, WireCredentialAuthTypeInput } from './auth-type'

export interface WireStatusResponse {
  status: 'ok'
  version: string
  catalog_revision: number
}

export interface WireRevisionResponse {
  revision: number
}

export interface WireAsset {
  id: string
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  description: string | null
  tags: string[]
  credential_id: string | null
  created_at: string | null
  updated_at: string | null
  ownership: 'local' | 'config'
}

export interface WireAssetWriteRequest {
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  description?: string | null
  tags?: string[]
  credential_id?: string | null
}

export interface WireCredential {
  id: string
  name: string
  username: string
  auth_type: WireCredentialAuthType
  password: SecretStatus
  private_key: SecretStatus
  passphrase: SecretStatus
  ownership: 'local' | 'config'
}

export interface WireCredentialWriteRequest {
  name: string
  username: string
  auth_type: WireCredentialAuthTypeInput
  password?: string | null
  private_key?: string | null
  passphrase?: string | null
}

export interface WireAccessKey {
  id: string
  name: string
  fingerprint: string
  enabled: boolean
  access_mode: AccessMode
  assets: string[] | null
  ownership: 'local' | 'config'
}

export interface WireAccessKeyCreateRequest {
  name: string
  public_key: string
  assets?: string[] | null
}

export interface WireSession {
  id: string
  key_finger: string
  key_name: string | null
  mode: string
  asset_name: string | null
  target_host: string | null
  target_port: number | null
  client_ip: string | null
  status: string
  error: string | null
  started_at: string | null
  ended_at: string | null
}

export interface WireTerminateResponse {
  id: string
  terminated: boolean
}

export interface WireKnownHost {
  hostname: string
  port: number
  key_type: string
  fingerprint: string
  first_seen: string | null
}

export interface WireKnownHostResetRequest {
  hostname: string
  port: number
  key_type: string
  confirm_reset: true
}

export interface WireConfigSourceStatus {
  source_id: string
  generation: number
  last_success_at: string | null
  last_success_revision: number | null
  last_error_at: string | null
  last_error_code: string | null
  last_error_message: string | null
}

export interface WireOrphanStatus {
  resource_type: string
  source_id: string
  source_key: string
  orphaned_at: string
}

export interface WireCatalogStatus {
  revision: number
  manifest_api_version: string
  sources: WireConfigSourceStatus[]
  orphans: WireOrphanStatus[]
}

export interface WireManifestPayload {
  content: string
  format: ManifestFormat
}

export interface WireValidateRequest extends WireManifestPayload {
  offline?: boolean
}

export interface WireValidationResponse {
  valid: true
  offline: boolean
}

export interface WireDiffRequest extends WireManifestPayload {
  source_id: string
  prune?: boolean
}

export interface WireApplyRequest extends WireManifestPayload {
  source_id: string
  base_revision: number
  prune?: boolean
  dry_run?: boolean
}

export interface WireApplyChange {
  resource_type: string
  name: string
  action: ApplyAction
}

export interface WireApplySummary {
  source_id: string
  base_revision: number
  new_revision: number
  generation: number
  dry_run: boolean
  created: number
  updated: number
  deleted: number
  orphaned: number
  unchanged: number
  changes: WireApplyChange[]
}

export interface WireReloadResponse {
  applied: WireApplySummary[]
}
