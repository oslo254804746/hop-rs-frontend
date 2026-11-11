import type {
  AccessMode,
  AssetProtocol,
  SecretStatus,
} from '@/domain'

import type { WireCredentialAuthType, WireCredentialAuthTypeInput } from './auth-type'

export interface WireStatusResponse {
  status: 'ok'
  version: string
  catalog_revision: number
  ssh_listen?: string
}

export interface WireRevisionResponse {
  revision: number
}

export interface WireAssetHealth {
  asset_id?: string
  status: string
  checked_at: string | null
  last_success_at: string | null
  latency_ms: number | null
  error_code: string | null
  error_message: string | null
}

export interface WireAsset {
  id: string
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  display_name?: string | null
  description: string | null
  tags: string[]
  credential_id: string | null
  created_at: string | null
  updated_at: string | null
  ownership: 'local' | 'config'
  health?: WireAssetHealth
}

export interface WireAssetWriteRequest {
  name: string
  protocol: AssetProtocol
  hostname: string
  port: number
  display_name?: string | null
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

export interface WireAuditEvent {
  id: string
  occurred_at: string | null
  actor_label: string
  action: string
  target_type: string
  target_id: string | null
  target_label: string | null
  result: string
  source_ip: string | null
  details_json: string | null
}
