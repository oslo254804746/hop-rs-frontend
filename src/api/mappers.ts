import type {
  AccessKey,
  AccessKeyCreateInput,
  ApplyManifestInput,
  ApplySummary,
  Asset,
  AssetWriteInput,
  CatalogStatus,
  ConfigSourceStatus,
  Credential,
  CredentialWriteInput,
  DiffManifestInput,
  InstanceStatus,
  KnownHost,
  KnownHostIdentity,
  Session,
  ValidateManifestInput,
} from '@/domain'

import { credentialAuthTypeFromApi, credentialAuthTypeToApi } from './auth-type'
import type {
  WireAccessKey,
  WireAccessKeyCreateRequest,
  WireApplyRequest,
  WireApplySummary,
  WireAsset,
  WireAssetWriteRequest,
  WireCatalogStatus,
  WireConfigSourceStatus,
  WireCredential,
  WireCredentialWriteRequest,
  WireDiffRequest,
  WireKnownHost,
  WireKnownHostResetRequest,
  WireSession,
  WireStatusResponse,
  WireValidateRequest,
} from './wire-types'

export function mapStatus(value: WireStatusResponse): InstanceStatus {
  return {
    status: value.status,
    version: value.version,
    catalogRevision: value.catalog_revision,
  }
}

export function mapAsset(value: WireAsset): Asset {
  return {
    id: value.id,
    name: value.name,
    protocol: value.protocol,
    hostname: value.hostname,
    port: value.port,
    description: value.description,
    tags: value.tags,
    credentialId: value.credential_id,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    management: { mode: value.ownership },
  }
}

export function mapAssetInput(value: AssetWriteInput): WireAssetWriteRequest {
  return {
    name: value.name,
    protocol: value.protocol,
    hostname: value.hostname,
    port: value.port,
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

export function mapConfigSource(value: WireConfigSourceStatus): ConfigSourceStatus {
  return {
    sourceId: value.source_id,
    generation: value.generation,
    lastSuccessAt: value.last_success_at,
    lastSuccessRevision: value.last_success_revision,
    lastErrorAt: value.last_error_at,
    lastErrorCode: value.last_error_code,
    lastErrorMessage: value.last_error_message,
  }
}

export function mapCatalogStatus(value: WireCatalogStatus): CatalogStatus {
  return {
    revision: value.revision,
    manifestApiVersion: value.manifest_api_version,
    sources: value.sources.map(mapConfigSource),
    orphans: value.orphans.map((orphan) => ({
      resourceType: orphan.resource_type,
      sourceId: orphan.source_id,
      sourceKey: orphan.source_key,
      orphanedAt: orphan.orphaned_at,
    })),
  }
}

export function mapValidateInput(value: ValidateManifestInput): WireValidateRequest {
  return {
    content: value.content,
    format: value.format,
    ...(value.offline !== undefined ? { offline: value.offline } : {}),
  }
}

export function mapDiffInput(value: DiffManifestInput): WireDiffRequest {
  return {
    content: value.content,
    format: value.format,
    source_id: value.sourceId,
    ...(value.prune !== undefined ? { prune: value.prune } : {}),
  }
}

export function mapApplyInput(value: ApplyManifestInput): WireApplyRequest {
  return {
    content: value.content,
    format: value.format,
    source_id: value.sourceId,
    base_revision: value.baseRevision,
    ...(value.prune !== undefined ? { prune: value.prune } : {}),
    ...(value.dryRun !== undefined ? { dry_run: value.dryRun } : {}),
  }
}

export function mapApplySummary(value: WireApplySummary): ApplySummary {
  return {
    sourceId: value.source_id,
    baseRevision: value.base_revision,
    newRevision: value.new_revision,
    generation: value.generation,
    dryRun: value.dry_run,
    created: value.created,
    updated: value.updated,
    deleted: value.deleted,
    orphaned: value.orphaned,
    unchanged: value.unchanged,
    changes: value.changes.map((change) => ({
      resourceType: change.resource_type,
      name: change.name,
      action: change.action,
    })),
  }
}
