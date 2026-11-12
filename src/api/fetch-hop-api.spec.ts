import { describe, expect, it } from 'vitest'

import { createFetchHopApi, type FetchLike, HopApiError, normalizeControlApiBaseUrl } from '@/api'

interface FetchCall {
  input: RequestInfo | URL
  init?: RequestInit
}

function queuedFetch(responses: Response[]): { calls: FetchCall[]; fetch: FetchLike } {
  const calls: FetchCall[] = []
  return {
    calls,
    fetch: async (input, init) => {
      calls.push(init === undefined ? { input } : { input, init })
      const response = responses.shift()
      if (response === undefined) throw new Error('Unexpected fetch call')
      return response
    },
  }
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

describe('createFetchHopApi', () => {
  it('normalizes the base URL, authenticates, maps status, and reports real capabilities', async () => {
    const stub = queuedFetch([
      jsonResponse({
        status: 'ok',
        version: '0.2.9',
        catalog_revision: 42,
        ssh_listen: '0.0.0.0:2222',
      }),
    ])
    const api = createFetchHopApi({
      baseUrl: 'https://hop.example/',
      token: 'management-token',
      fetch: stub.fetch,
    })

    await expect(api.getStatus()).resolves.toEqual({
      status: 'ok',
      version: '0.2.9',
      catalogRevision: 42,
      sshListen: '0.0.0.0:2222',
    })
    expect(api.capabilities).toEqual({
      ownership: true,
      assetHealth: true,
      auditEvents: true,
    })
    expect(stub.calls[0]?.input).toBe('https://hop.example/api/v1/status')
    const headers = new Headers(stub.calls[0]?.init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer management-token')
    expect(headers.get('Content-Type')).toBeNull()
  })

  it('maps asset health, probe endpoints, and audit events', async () => {
    const stub = queuedFetch([
      jsonResponse({
        id: 'asset-1',
        name: 'hk-edge-01',
        protocol: 'ssh',
        hostname: '203.0.113.10',
        port: 22,
        display_name: 'HK Edge',
        description: null,
        tags: ['edge'],
        credential_id: 'cred-1',
        created_at: '2026-08-14 09:00:00',
        updated_at: '2026-08-14 09:00:00',
        ownership: 'local',
        health: {
          asset_id: 'asset-1',
          status: 'healthy',
          checked_at: '2026-08-14 09:01:00',
          last_success_at: '2026-08-14 09:01:00',
          latency_ms: 14,
          error_code: null,
          error_message: null,
        },
      }),
      jsonResponse([
        {
          id: 'audit-1',
          occurred_at: '2026-08-14 09:01:00',
          actor_label: 'api-token',
          action: 'asset.probe',
          target_type: 'asset',
          target_id: 'asset-1',
          target_label: 'hk-edge-01',
          result: 'success',
          source_ip: null,
          details_json: '{"latency_ms":14}',
        },
      ]),
    ])
    const api = createFetchHopApi({ baseUrl: '', token: 'token', fetch: stub.fetch })

    const probed = await api.probeAsset('asset-1')
    expect(probed.displayName).toBe('HK Edge')
    expect(probed.health).toEqual({
      status: 'healthy',
      checkedAt: '2026-08-14 09:01:00',
      lastSuccessAt: '2026-08-14 09:01:00',
      latencyMs: 14,
    })
    expect(stub.calls[0]?.input).toBe('/api/v1/assets/asset-1/probe')
    expect(stub.calls[0]?.init?.method).toBe('POST')

    const events = await api.listAuditEvents()
    expect(events).toEqual([
      {
        id: 'audit-1',
        occurredAt: '2026-08-14 09:01:00',
        actorLabel: 'api-token',
        action: 'asset.probe',
        targetType: 'asset',
        targetId: 'asset-1',
        targetLabel: 'hk-edge-01',
        result: 'success',
        sourceIp: null,
        detailsJson: '{"latency_ms":14}',
      },
    ])
    expect(stub.calls[1]?.input).toBe('/api/v1/audit-events')
  })

  it('maps key+passphrase responses and key_passphrase request bodies', async () => {
    const stub = queuedFetch([
      jsonResponse({
        id: 'credential-1',
        name: 'deploy',
        username: 'deploy',
        auth_type: 'key+passphrase',
        password: 'missing',
        private_key: 'configured',
        passphrase: 'configured',
      }),
    ])
    const api = createFetchHopApi({ baseUrl: '/proxy/api/v1', token: 'token', fetch: stub.fetch })

    const credential = await api.createCredential({
      name: 'deploy',
      username: 'deploy',
      authType: 'key_passphrase',
      privateKey: 'private material',
      passphrase: 'secret',
    })

    expect(credential.authType).toBe('key_passphrase')
    expect(stub.calls[0]?.input).toBe('/proxy/api/v1/credentials')
    expect(JSON.parse(String(stub.calls[0]?.init?.body))).toEqual({
      name: 'deploy',
      username: 'deploy',
      auth_type: 'key_passphrase',
      private_key: 'private material',
      passphrase: 'secret',
    })
  })

  it('accepts a 204 response without attempting JSON parsing', async () => {
    const stub = queuedFetch([new Response(null, { status: 204 })])
    const api = createFetchHopApi({ baseUrl: '', token: 'token', fetch: stub.fetch })

    await expect(api.deleteAsset('asset/with spaces')).resolves.toBeUndefined()
    expect(stub.calls[0]?.input).toBe('/api/v1/assets/asset%2Fwith%20spaces')
  })

  it('lists Known Hosts and sends an explicit trust-reset confirmation', async () => {
    const stub = queuedFetch([
      jsonResponse([
        {
          hostname: '192.0.2.10',
          port: 22,
          key_type: 'ssh-ed25519',
          fingerprint: 'SHA256:old',
          first_seen: '2026-08-16 10:00:00',
        },
      ]),
      new Response(null, { status: 204 }),
    ])
    const api = createFetchHopApi({ baseUrl: '', token: 'token', fetch: stub.fetch })

    await expect(api.listKnownHosts()).resolves.toEqual([
      {
        hostname: '192.0.2.10',
        port: 22,
        keyType: 'ssh-ed25519',
        fingerprint: 'SHA256:old',
        firstSeen: '2026-08-16 10:00:00',
      },
    ])
    await expect(
      api.resetKnownHost({ hostname: '192.0.2.10', port: 22, keyType: 'ssh-ed25519' }),
    ).resolves.toBeUndefined()

    expect(stub.calls[1]?.input).toBe('/api/v1/known-hosts')
    expect(stub.calls[1]?.init?.method).toBe('DELETE')
    expect(JSON.parse(String(stub.calls[1]?.init?.body))).toEqual({
      hostname: '192.0.2.10',
      port: 22,
      key_type: 'ssh-ed25519',
      confirm_reset: true,
    })
  })

  it('normalizes structured API errors and preserves path metadata', async () => {
    const stub = queuedFetch([
      jsonResponse(
        {
          code: 'managed_by_source',
          path: 'asset',
          message: 'resource is managed by configuration',
        },
        { status: 409 },
      ),
    ])
    const api = createFetchHopApi({ baseUrl: 'https://hop.example', token: 'token', fetch: stub.fetch })

    await expect(
      api.updateAsset('asset-1', {
        name: 'prod',
        protocol: 'ssh',
        hostname: '10.0.0.1',
        port: 22,
      }),
    ).rejects.toMatchObject<Partial<HopApiError>>({
      name: 'HopApiError',
      kind: 'http',
      status: 409,
      code: 'managed_by_source',
      path: 'asset',
      retryable: false,
    })
  })

  it('normalizes text extractor errors instead of assuming an error JSON shape', async () => {
    const stub = queuedFetch([
      new Response('Failed to deserialize the JSON body', {
        status: 422,
        headers: { 'Content-Type': 'text/plain' },
      }),
    ])
    const api = createFetchHopApi({ baseUrl: 'https://hop.example', token: 'token', fetch: stub.fetch })

    await expect(api.listAssets()).rejects.toMatchObject<Partial<HopApiError>>({
      kind: 'http',
      status: 422,
      code: 'http_422',
      message: 'Failed to deserialize the JSON body',
    })
  })

  it('turns invalid success JSON and transport failures into stable client errors', async () => {
    const invalidJson = queuedFetch([new Response('{', { status: 200 })])
    const invalidApi = createFetchHopApi({ baseUrl: '', token: 'token', fetch: invalidJson.fetch })
    await expect(invalidApi.getRevision()).rejects.toMatchObject<Partial<HopApiError>>({
      kind: 'invalid_response',
      code: 'invalid_response',
      status: 200,
    })

    const networkApi = createFetchHopApi({
      baseUrl: '',
      token: 'token',
      fetch: async () => {
        throw new TypeError('connection refused')
      },
    })
    await expect(networkApi.getStatus()).rejects.toMatchObject<Partial<HopApiError>>({
      kind: 'network',
      code: 'network_error',
      status: null,
      retryable: true,
    })
  })

  it('maps v0.3.0 via_asset, bootstrap-key, probe-history, probe-settings, and notification-channels endpoints', async () => {
    const stub = queuedFetch([
      jsonResponse({
        asset: {
          id: 'asset-2',
          name: 'lax-box',
          protocol: 'ssh',
          hostname: '10.99.0.5',
          port: 22,
          display_name: 'LAX Box',
          description: null,
          tags: ['us'],
          credential_id: 'cred-ed25519',
          via_asset_id: 'asset-1',
          via_asset_name: 'hk-edge-01',
          allow_tcp_forwarding: true,
          created_at: '2026-11-12 08:00:00',
          updated_at: '2026-11-12 08:02:00',
          ownership: 'local',
          health: {
            asset_id: 'asset-2',
            status: 'healthy',
            checked_at: '2026-11-12 08:02:00',
            last_success_at: '2026-11-12 08:02:00',
            latency_ms: 48,
            consecutive_failures: 0,
            alert_firing: false,
          },
        },
        credential: {
          id: 'cred-ed25519',
          name: 'lax-box-ed25519',
          username: 'root',
          auth_type: 'key',
          password: 'missing',
          private_key: 'configured',
          passphrase: 'missing',
          ownership: 'local',
        },
        public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest hop@lax-box',
        public_key_fingerprint: 'SHA256:testfp',
        verified_key_login: true,
        pruned_previous_credential: true,
        password_auth_disabled: false,
        warnings: [],
      }),
      jsonResponse({
        'asset-2': [
          {
            id: 1,
            asset_id: 'asset-2',
            checked_at: '2026-11-12 08:02:00',
            status: 'healthy',
            latency_ms: 48,
            error_code: null,
          },
        ],
      }),
      jsonResponse({
        enabled: true,
        interval_seconds: 120,
        timeout_ms: 4500,
        failure_threshold: 2,
        notify_on_recovery: true,
        updated_at: '2026-11-12 08:03:00',
      }),
      jsonResponse({
        id: 'ch-1',
        name: 'Ops TG',
        kind: 'telegram',
        enabled: true,
        config: {
          chat_id: '-100999',
          api_base_url: null,
          has_secret: true,
        },
        created_at: '2026-11-12 08:03:00',
        updated_at: '2026-11-12 08:03:00',
      }),
      jsonResponse({ delivered: true }),
    ])
    const api = createFetchHopApi({ baseUrl: '', token: 'token', fetch: stub.fetch })

    const bootstrap = await api.bootstrapAssetKey('asset-2', {
      username: 'root',
      password: 'initial-password',
      prunePreviousCredential: true,
      disablePasswordAuth: false,
    })
    expect(bootstrap.verifiedKeyLogin).toBe(true)
    expect(bootstrap.asset.viaAssetName).toBe('hk-edge-01')
    expect(bootstrap.credential.authType).toBe('key')
    expect(stub.calls[0]?.input).toBe('/api/v1/assets/asset-2/bootstrap-key')

    const history = await api.getAllProbeHistory()
    expect(history['asset-2']).toHaveLength(1)
    expect(stub.calls[1]?.input).toBe('/api/v1/assets/probe-history')

    const settings = await api.updateProbeSettings({
      enabled: true,
      intervalSeconds: 120,
      timeoutMs: 4500,
      failureThreshold: 2,
      notifyOnRecovery: true,
    })
    expect(settings.intervalSeconds).toBe(120)
    expect(stub.calls[2]?.input).toBe('/api/v1/probe/settings')
    expect(stub.calls[2]?.init?.method).toBe('PUT')

    const channel = await api.createNotificationChannel({
      name: 'Ops TG',
      kind: 'telegram',
      enabled: true,
      config: { chatId: '-100999', botToken: '123:ABC' },
    })
    expect(channel.config.hasSecret).toBe(true)
    expect(stub.calls[3]?.input).toBe('/api/v1/notifications/channels')

    const tested = await api.testNotificationChannel('ch-1')
    expect(tested).toEqual({ delivered: true })
    expect(stub.calls[4]?.input).toBe('/api/v1/notifications/channels/ch-1/test')
  })
})

describe('normalizeControlApiBaseUrl', () => {
  it.each([
    ['', '/api/v1'],
    ['/', '/api/v1'],
    ['https://hop.example', 'https://hop.example/api/v1'],
    ['https://hop.example/api/v1/', 'https://hop.example/api/v1'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeControlApiBaseUrl(input)).toBe(expected)
  })
})
