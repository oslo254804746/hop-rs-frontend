import { describe, expect, it } from 'vitest'

import { HopApiError } from '@/api'
import { createDemoHopApi } from '@/demo'

describe('createDemoHopApi', () => {
  it('returns isolated fixtures with explicit demo-only capabilities', async () => {
    const first = createDemoHopApi()
    const second = createDemoHopApi()
    const assets = await first.listAssets()
    assets[0]!.name = 'mutated outside adapter'

    expect(first.mode).toBe('demo')
    expect(first.capabilities).toEqual({ ownership: true, assetHealth: true })
    expect((await first.listAssets())[0]?.name).toBe('prod-gateway')
    expect((await second.listAssets())[0]?.name).toBe('prod-gateway')
  })

  it('creates local resources, clears credentials on TCP assets, and increments revision', async () => {
    const api = createDemoHopApi()
    const before = await api.getRevision()

    const asset = await api.createAsset({
      name: 'database-console',
      protocol: 'tcp',
      hostname: '10.24.4.20',
      port: 5432,
      credentialId: 'credential-homelab',
    })

    expect(asset).toMatchObject({
      name: 'database-console',
      credentialId: null,
      management: { mode: 'local' },
      health: { status: 'unknown' },
    })
    expect(await api.getRevision()).toBe(before + 1)
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

  it('rejects stale apply revisions and applies against the current revision', async () => {
    const api = createDemoHopApi()
    const input = {
      content: 'api_version: hop/v1alpha1\nassets: {}\n',
      format: 'yaml' as const,
      sourceId: 'panel',
      baseRevision: 127,
    }

    await expect(api.applyManifest(input)).rejects.toMatchObject<Partial<HopApiError>>({
      status: 409,
      code: 'revision_conflict',
      path: 'catalog_revision',
    })

    const currentRevision = await api.getRevision()
    const summary = await api.applyManifest({ ...input, baseRevision: currentRevision })
    expect(summary).toMatchObject({
      baseRevision: currentRevision,
      newRevision: currentRevision + 1,
      dryRun: false,
      updated: 1,
    })
    expect(await api.getRevision()).toBe(currentRevision + 1)
  })
})
