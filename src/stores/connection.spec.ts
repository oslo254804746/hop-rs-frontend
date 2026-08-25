// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tokenKey = 'hop.management-token'

function statusResponse() {
  return new Response(JSON.stringify({ version: '0.2.4', catalog_revision: 17 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  window.sessionStorage.clear()
  document.head.innerHTML = ''
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('connection session', () => {
  it('saves a validated Token for the current tab session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse()))
    const { useConnection } = await import('./connection')

    await useConnection().connectToHop('', '  management-token  ')

    expect(window.sessionStorage.getItem(tokenKey)).toBe('management-token')
  })

  it('restores and validates the saved Token after the module reloads', async () => {
    window.sessionStorage.setItem(tokenKey, 'saved-token')
    const fetchMock = vi.fn().mockResolvedValue(statusResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { useConnection } = await import('./connection')
    const connection = useConnection()

    await expect(connection.restoreConnection()).resolves.toBe(true)
    expect(connection.state.mode).toBe('live')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/status', {
      headers: { Authorization: 'Bearer saved-token' },
    })
  })

  it('discards a saved Token that can no longer be validated', async () => {
    window.sessionStorage.setItem(tokenKey, 'expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    const { useConnection } = await import('./connection')

    await expect(useConnection().restoreConnection()).resolves.toBe(false)
    expect(window.sessionStorage.getItem(tokenKey)).toBeNull()
  })

  it('clears the saved Token when leaving the live connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse()))
    const { useConnection } = await import('./connection')
    const connection = useConnection()

    await connection.connectToHop('', 'management-token')
    connection.useDemo()
    expect(window.sessionStorage.getItem(tokenKey)).toBeNull()

    window.sessionStorage.setItem(tokenKey, 'management-token')
    connection.requireReauthentication()
    expect(window.sessionStorage.getItem(tokenKey)).toBeNull()
  })
})
