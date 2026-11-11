import type {
  AccessKey,
  AccessKeyCreateInput,
  Asset,
  AssetHealth,
  AssetWriteInput,
  AuditEvent,
  Credential,
  CredentialWriteInput,
  InstanceStatus,
  KnownHost,
  KnownHostIdentity,
  Session,
} from '@/domain'

import { credentialAuthTypeFromApi, credentialAuthTypeToApi } from './auth-type'
import type {
  WireAccessKey,
  WireAccessKeyCreateRequest,
  WireAsset,
  WireAssetHealth,
  WireAssetWriteRequest,
  WireAuditEvent,
  WireCredential,
  WireCredentialWriteRequest,
  WireKnownHost,
  WireKnownHostResetRequest,
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
  if (!value || value.status === 'unknown') {
    return {
      status: 'unknown',
      checkedAt: value?.checked_at ?? null,
    }
  }
  if (value.status === 'healthy') {
    return {
      status: 'healthy',
      checkedAt: value.checked_at,
      lastSuccessAt: value.last_success_at,
      latencyMs: value.latency_ms,
    }
  }
  return {
    status: 'failed',
    checkedAt: value.checked_at,
    lastSuccessAt: value.last_success_at,
    errorCode: value.error_code,
    errorMessage: value.error_message,
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
