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
  consecutive_failures?: number
  alert_firing?: boolean
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
  via_asset_id?: string | null
  via_asset_name?: string | null
  allow_tcp_forwarding?: boolean
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
  via_asset_id?: string | null
  allow_tcp_forwarding?: boolean
}

export interface WireAssetProbeSample {
  id: number
  asset_id: string
  checked_at: string
  status: string
  latency_ms: number | null
  error_code: string | null
}

export interface WireBootstrapKeyRequest {
  username?: string | null
  password?: string | null
  credential_name?: string | null
  disable_password_auth?: boolean
  prune_previous_credential?: boolean
}

export interface WireBootstrapKeyResponse {
  asset: WireAsset
  credential: WireCredential
  public_key: string
  public_key_fingerprint: string
  verified_key_login: boolean
  pruned_previous_credential: boolean
  password_auth_disabled: boolean
  warnings: string[]
}

export interface WireProbeSettings {
  enabled: boolean
  interval_seconds: number
  timeout_ms: number
  failure_threshold: number
  notify_on_recovery: boolean
  updated_at: string | null
}

export interface WireProbeSettingsWriteRequest {
  enabled: boolean
  interval_seconds: number
  timeout_ms: number
  failure_threshold: number
  notify_on_recovery: boolean
}

export interface WireNotificationConfigSummary {
  chat_id?: string | null
  api_base_url?: string | null
  server_url?: string | null
  url?: string | null
  has_secret: boolean
}

export interface WireNotificationConfigInput {
  bot_token?: string | null
  chat_id?: string | null
  api_base_url?: string | null
  server_url?: string | null
  device_key?: string | null
  url?: string | null
  secret?: string | null
}

export interface WireNotificationChannel {
  id: string
  name: string
  kind: 'telegram' | 'bark' | 'webhook'
  enabled: boolean
  config: WireNotificationConfigSummary
  created_at: string | null
  updated_at: string | null
}

export interface WireNotificationChannelWriteRequest {
  name: string
  kind: 'telegram' | 'bark' | 'webhook'
  enabled: boolean
  config: WireNotificationConfigInput
}

export interface WireNotificationTestResponse {
  delivered: boolean
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
