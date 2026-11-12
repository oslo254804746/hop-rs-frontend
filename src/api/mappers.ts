import type {
  AccessKey,
  AccessKeyCreateInput,
  Asset,
  AssetHealth,
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
  ProbeSettings,
  ProbeSettingsWriteInput,
  Session,
} from '@/domain'

import { credentialAuthTypeFromApi, credentialAuthTypeToApi } from './auth-type'
import type {
  WireAccessKey,
  WireAccessKeyCreateRequest,
  WireAsset,
  WireAssetHealth,
  WireAssetProbeSample,
  WireAssetWriteRequest,
  WireAuditEvent,
  WireBootstrapKeyRequest,
  WireBootstrapKeyResponse,
  WireCredential,
  WireCredentialWriteRequest,
  WireKnownHost,
  WireKnownHostResetRequest,
  WireNotificationChannel,
  WireNotificationChannelWriteRequest,
  WireProbeSettings,
  WireProbeSettingsWriteRequest,
  WireSession,
  WireStatusResponse,
} from './wire-types'

export function mapStatus(value: WireStatusResponse): InstanceStatus {
  return {
    status: value.status,
    version: value.version,
    catalogRevision: value.catalog_revision,
    ...(value.ssh_listen !== undefined ? { sshListen: value.ssh_listen } : {}),
  }
}

export function mapAssetHealth(value?: WireAssetHealth): AssetHealth {
  const alertMeta = {
    ...(value?.consecutive_failures !== undefined
      ? { consecutiveFailures: value.consecutive_failures }
      : {}),
    ...(value?.alert_firing !== undefined ? { alertFiring: value.alert_firing } : {}),
  }
  if (!value || value.status === 'unknown') {
    return {
      status: 'unknown',
      checkedAt: value?.checked_at ?? null,
      ...alertMeta,
    }
  }
  if (value.status === 'healthy') {
    return {
      status: 'healthy',
      checkedAt: value.checked_at,
      lastSuccessAt: value.last_success_at,
      latencyMs: value.latency_ms,
      ...alertMeta,
    }
  }
  return {
    status: 'failed',
    checkedAt: value.checked_at,
    lastSuccessAt: value.last_success_at,
    errorCode: value.error_code,
    errorMessage: value.error_message,
    ...alertMeta,
  }
}

export function mapAsset(value: WireAsset): Asset {
  return {
    id: value.id,
    name: value.name,
    protocol: value.protocol,
    hostname: value.hostname,
    port: value.port,
    displayName: value.display_name ?? null,
    description: value.description,
    tags: value.tags,
    credentialId: value.credential_id,
    ...(value.via_asset_id !== undefined ? { viaAssetId: value.via_asset_id } : {}),
    ...(value.via_asset_name !== undefined ? { viaAssetName: value.via_asset_name } : {}),
    ...(value.allow_tcp_forwarding !== undefined
      ? { allowTcpForwarding: value.allow_tcp_forwarding }
      : {}),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    management: { mode: value.ownership },
    health: mapAssetHealth(value.health),
  }
}

export function mapAssetInput(value: AssetWriteInput): WireAssetWriteRequest {
  return {
    name: value.name,
    protocol: value.protocol,
    hostname: value.hostname,
    port: value.port,
    ...(value.displayName !== undefined ? { display_name: value.displayName } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.tags !== undefined ? { tags: value.tags } : {}),
    ...(value.credentialId !== undefined ? { credential_id: value.credentialId } : {}),
    ...(value.viaAssetId !== undefined ? { via_asset_id: value.viaAssetId } : {}),
    ...(value.allowTcpForwarding !== undefined
      ? { allow_tcp_forwarding: value.allowTcpForwarding }
      : {}),
  }
}

export function mapAssetProbeSample(value: WireAssetProbeSample): AssetProbeSample {
  return {
    id: value.id,
    assetId: value.asset_id,
    checkedAt: value.checked_at,
    status: value.status,
    latencyMs: value.latency_ms,
    errorCode: value.error_code,
  }
}

export function mapBootstrapKeyInput(value: BootstrapKeyInput): WireBootstrapKeyRequest {
  return {
    ...(value.username !== undefined ? { username: value.username } : {}),
    ...(value.password !== undefined ? { password: value.password } : {}),
    ...(value.credentialName !== undefined ? { credential_name: value.credentialName } : {}),
    ...(value.disablePasswordAuth !== undefined
      ? { disable_password_auth: value.disablePasswordAuth }
      : {}),
    ...(value.prunePreviousCredential !== undefined
      ? { prune_previous_credential: value.prunePreviousCredential }
      : {}),
  }
}

export function mapBootstrapKeyResponse(value: WireBootstrapKeyResponse): BootstrapKeyResult {
  return {
    asset: mapAsset(value.asset),
    credential: mapCredential(value.credential),
    publicKey: value.public_key,
    publicKeyFingerprint: value.public_key_fingerprint,
    verifiedKeyLogin: value.verified_key_login,
    prunedPreviousCredential: value.pruned_previous_credential,
    passwordAuthDisabled: value.password_auth_disabled,
    warnings: value.warnings,
  }
}

export function mapProbeSettings(value: WireProbeSettings): ProbeSettings {
  return {
    enabled: value.enabled,
    intervalSeconds: value.interval_seconds,
    timeoutMs: value.timeout_ms,
    failureThreshold: value.failure_threshold,
    notifyOnRecovery: value.notify_on_recovery,
    updatedAt: value.updated_at,
  }
}

export function mapProbeSettingsInput(
  value: ProbeSettingsWriteInput,
): WireProbeSettingsWriteRequest {
  return {
    enabled: value.enabled,
    interval_seconds: value.intervalSeconds,
    timeout_ms: value.timeoutMs,
    failure_threshold: value.failureThreshold,
    notify_on_recovery: value.notifyOnRecovery,
  }
}

export function mapNotificationChannel(value: WireNotificationChannel): NotificationChannel {
  return {
    id: value.id,
    name: value.name,
    kind: value.kind,
    enabled: value.enabled,
    config: {
      ...(value.config.chat_id !== undefined ? { chatId: value.config.chat_id } : {}),
      ...(value.config.api_base_url !== undefined
        ? { apiBaseUrl: value.config.api_base_url }
        : {}),
      ...(value.config.server_url !== undefined ? { serverUrl: value.config.server_url } : {}),
      ...(value.config.url !== undefined ? { url: value.config.url } : {}),
      hasSecret: value.config.has_secret,
    },
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  }
}

export function mapNotificationChannelInput(
  value: NotificationChannelWriteInput,
): WireNotificationChannelWriteRequest {
  return {
    name: value.name,
    kind: value.kind,
    enabled: value.enabled,
    config: {
      ...(value.config.botToken !== undefined ? { bot_token: value.config.botToken } : {}),
      ...(value.config.chatId !== undefined ? { chat_id: value.config.chatId } : {}),
      ...(value.config.apiBaseUrl !== undefined ? { api_base_url: value.config.apiBaseUrl } : {}),
      ...(value.config.serverUrl !== undefined ? { server_url: value.config.serverUrl } : {}),
      ...(value.config.deviceKey !== undefined ? { device_key: value.config.deviceKey } : {}),
      ...(value.config.url !== undefined ? { url: value.config.url } : {}),
      ...(value.config.secret !== undefined ? { secret: value.config.secret } : {}),
    },
  }
}

export function mapCredential(value: WireCredential): Credential {
  return {
    id: value.id,
    name: value.name,
    username: value.username,
    authType: credentialAuthTypeFromApi(value.auth_type),
    password: value.password,
    privateKey: value.private_key,
    passphrase: value.passphrase,
    management: { mode: value.ownership },
  }
}

export function mapCredentialInput(value: CredentialWriteInput): WireCredentialWriteRequest {
  return {
    name: value.name,
    username: value.username,
    auth_type: credentialAuthTypeToApi(value.authType),
    ...(value.password !== undefined ? { password: value.password } : {}),
    ...(value.privateKey !== undefined ? { private_key: value.privateKey } : {}),
    ...(value.passphrase !== undefined ? { passphrase: value.passphrase } : {}),
  }
}

export function mapAccessKey(value: WireAccessKey): AccessKey {
  return {
    id: value.id,
    name: value.name,
    fingerprint: value.fingerprint,
    enabled: value.enabled,
    accessMode: value.access_mode,
    assetIds: value.assets,
    management: { mode: value.ownership },
  }
}

export function mapAccessKeyInput(value: AccessKeyCreateInput): WireAccessKeyCreateRequest {
  return {
    name: value.name,
    public_key: value.publicKey,
    ...(value.assetIds !== undefined ? { assets: value.assetIds } : {}),
  }
}

export function mapSession(value: WireSession): Session {
  return {
    id: value.id,
    keyFingerprint: value.key_finger,
    keyName: value.key_name,
    mode: value.mode,
    assetName: value.asset_name,
    targetHost: value.target_host,
    targetPort: value.target_port,
    clientIp: value.client_ip,
    status: value.status,
    error: value.error,
    startedAt: value.started_at,
    endedAt: value.ended_at,
  }
}

export function mapKnownHost(value: WireKnownHost): KnownHost {
  return {
    hostname: value.hostname,
    port: value.port,
    keyType: value.key_type,
    fingerprint: value.fingerprint,
    firstSeen: value.first_seen,
  }
}

export function mapKnownHostResetInput(value: KnownHostIdentity): WireKnownHostResetRequest {
  return {
    hostname: value.hostname,
    port: value.port,
    key_type: value.keyType,
    confirm_reset: true,
  }
}

export function mapAuditEvent(value: WireAuditEvent): AuditEvent {
  return {
    id: value.id,
    occurredAt: value.occurred_at,
    actorLabel: value.actor_label,
    action: value.action,
    targetType: value.target_type,
    targetId: value.target_id,
    targetLabel: value.target_label,
    result: value.result,
    sourceIp: value.source_ip,
    detailsJson: value.details_json,
  }
}
