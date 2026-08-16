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
      jsonResponse({ status: 'ok', version: '0.2.1', catalog_revision: 42 }),
    ])
    const api = createFetchHopApi({
      baseUrl: 'https://hop.example/',
      token: 'management-token',
      fetch: stub.fetch,
    })

    await expect(api.getStatus()).resolves.toEqual({
      status: 'ok',
      version: '0.2.1',
      catalogRevision: 42,
    })
    expect(api.capabilities).toEqual({ ownership: true, assetHealth: false })
    expect(stub.calls[0]?.input).toBe('https://hop.example/api/v1/status')
    const headers = new Headers(stub.calls[0]?.init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer management-token')
    expect(headers.get('Content-Type')).toBeNull()
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
          code: 'revision_conflict',
          path: 'catalog_revision',
          message: 'base revision 4 does not match current revision 5',
        },
        { status: 409 },
      ),
    ])
    const api = createFetchHopApi({ baseUrl: 'https://hop.example', token: 'token', fetch: stub.fetch })

    await expect(
      api.applyManifest({
        content: 'api_version: hop/v1alpha1\n',
        format: 'yaml',
        sourceId: 'panel',
        baseRevision: 4,
      }),
    ).rejects.toMatchObject<Partial<HopApiError>>({
      name: 'HopApiError',
      kind: 'http',
      status: 409,
      code: 'revision_conflict',
      path: 'catalog_revision',
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
