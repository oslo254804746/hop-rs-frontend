import { describe, expect, it } from 'vitest'

import { HopApiError } from '@/api'
import { createDemoHopApi } from '@/demo'

describe('createDemoHopApi', () => {
  it('returns isolated fixtures with v0.2.9 capabilities', async () => {
    const first = createDemoHopApi()
    const second = createDemoHopApi()
    const assets = await first.listAssets()
    assets[0]!.name = 'mutated outside adapter'

    expect(first.mode).toBe('demo')
    expect(first.capabilities).toEqual({
      ownership: true,
      assetHealth: true,
      auditEvents: true,
    })
    expect((await first.listAssets())[0]?.name).toBe('prod-gateway')
    expect((await second.listAssets())[0]?.name).toBe('prod-gateway')
  })

  it('creates local resources, clears credentials on TCP assets, and records audit events', async () => {
    const api = createDemoHopApi()
    const before = await api.getRevision()

    const asset = await api.createAsset({
      name: 'database-console',
      protocol: 'tcp',
      hostname: '10.24.4.20',
      port: 5432,
      displayName: 'Primary Postgres',
      credentialId: 'credential-homelab',
    })

    expect(asset).toMatchObject({
      name: 'database-console',
      displayName: 'Primary Postgres',
      credentialId: null,
      management: { mode: 'local' },
      health: { status: 'unknown' },
    })
    expect(await api.getRevision()).toBe(before + 1)

    const auditEvents = await api.listAuditEvents()
    expect(auditEvents[0]).toMatchObject({
      action: 'asset.create',
      targetType: 'asset',
      targetLabel: 'database-console',
      result: 'success',
    })
  })

  it('probes single and fleet assets and records probe audit events', async () => {
    const api = createDemoHopApi()

    const probed = await api.probeAsset('asset-build-runner')
    expect(probed.health?.status).toBe('healthy')

    const all = await api.probeAssets()
    expect(all.find((item) => item.id === 'asset-staging-node')?.health?.status).toBe('healthy')
    expect(all.find((item) => item.id === 'asset-router-ui')?.health?.status).toBe('failed')

    const auditEvents = await api.listAuditEvents()
    expect(auditEvents[0]?.action).toBe('asset.probe_all')
    expect(auditEvents[1]?.action).toBe('asset.probe')
  })

  it('enforces declarative ownership before mutations', async () => {
    const api = createDemoHopApi()

    await expect(
      api.updateAsset('asset-prod-gateway', {
        name: 'prod-gateway',
        protocol: 'ssh',
        hostname: '10.24.0.99',
        port: 22,
      }),
    ).rejects.toMatchObject<Partial<HopApiError>>({
      status: 409,
      code: 'managed_by_source',
      message: 'managed_by_source: resource is managed by the startup configuration',
    })
    expect((await api.listAssets()).find((asset) => asset.id === 'asset-prod-gateway')?.hostname).toBe(
      '10.24.0.12',
    )
  })

  it('preserves all, restricted, and explicit deny-all access scopes', async () => {
    const api = createDemoHopApi()
    const created = await api.createAccessKey({
      name: 'new-laptop',
      publicKey: 'ssh-ed25519 AAAA demo',
    })
    expect(created).toMatchObject({ accessMode: 'all', assetIds: null, enabled: true })

    const denied = await api.setAccessKeyAccess(created.id, [])
    expect(denied).toMatchObject({ accessMode: 'restricted', assetIds: [] })

    const restored = await api.setAccessKeyAccess(created.id, null)
    expect(restored).toMatchObject({ accessMode: 'all', assetIds: null })
  })

  it('returns terminated=false for sessions that are not actively registered', async () => {
    const api = createDemoHopApi()

    await expect(api.terminateSession('missing')).resolves.toEqual({
      id: 'missing',
      terminated: false,
    })
    await expect(api.terminateSession('session-active-shell')).resolves.toEqual({
      id: 'session-active-shell',
      terminated: true,
    })
    await expect(api.terminateSession('session-active-shell')).resolves.toEqual({
      id: 'session-active-shell',
      terminated: false,
    })
  })

  it('resets only the selected Known Hosts identity', async () => {
    const api = createDemoHopApi()
    const hosts = await api.listKnownHosts()
    const selected = hosts[0]!

    await api.resetKnownHost({
      hostname: selected.hostname,
      port: selected.port,
      keyType: selected.keyType,
    })

    const remaining = await api.listKnownHosts()
    expect(remaining).toHaveLength(hosts.length - 1)
    expect(remaining).not.toContainEqual(selected)
    await expect(
      api.resetKnownHost({
        hostname: selected.hostname,
        port: selected.port,
        keyType: selected.keyType,
      }),
    ).rejects.toMatchObject<Partial<HopApiError>>({ status: 404, code: 'not_found' })
  })

  it('supports v0.3.0 bootstrapAssetKey, via_asset cycle rejection, probe history, and alert channels', async () => {
    const api = createDemoHopApi()

    const history = await api.getAllProbeHistory(12)
    expect(history['asset-prod-gateway']?.length).toBeLessThanOrEqual(12)

    await expect(
      api.updateAsset('asset-staging-node', {
        name: 'staging-node',
        protocol: 'ssh',
        hostname: '10.24.1.18',
        port: 22,
        credentialId: 'credential-deploy',
        viaAssetId: 'asset-staging-node',
      }),
    ).rejects.toMatchObject<Partial<HopApiError>>({ status: 422, code: 'validation_failed' })

    const bootstrapped = await api.bootstrapAssetKey('asset-staging-node', {
      username: 'root',
      password: 'initial-root-password',
      disablePasswordAuth: true,
    })
    expect(bootstrapped.verifiedKeyLogin).toBe(true)
    expect(bootstrapped.passwordAuthDisabled).toBe(true)
    expect(bootstrapped.asset.credentialId).toBe(bootstrapped.credential.id)

    const updatedPolicy = await api.updateProbeSettings({
      enabled: true,
      intervalSeconds: 120,
      timeoutMs: 3500,
      failureThreshold: 3,
      notifyOnRecovery: true,
    })
    expect(updatedPolicy.failureThreshold).toBe(3)

    const channels = await api.listNotificationChannels()
    expect(channels.length).toBeGreaterThanOrEqual(2)
    const testResult = await api.testNotificationChannel(channels[0]!.id)
    expect(testResult).toEqual({ delivered: true })
  })
})
