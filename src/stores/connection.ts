import { computed, reactive, readonly } from 'vue'

import { getPanelRuntimeConfig } from '@/api/runtime-config'

export type ConnectionMode = 'demo' | 'live' | 'reauth'

interface ConnectionState {
  mode: ConnectionMode
  endpoint: string
  token: string
  insecureToken: boolean
  version: string | null
  revision: number | null
  error: string | null
  connecting: boolean
}

const endpointKey = 'hop.control-api-url'
const tokenKey = 'hop.management-token'
const savedEndpoint = window.sessionStorage.getItem(endpointKey) ?? ''
const defaultControlApiBaseUrl = getPanelRuntimeConfig().controlApiBaseUrl

const state = reactive<ConnectionState>({
  mode: 'reauth',
  endpoint: savedEndpoint,
  token: '',
  insecureToken: false,
  version: null,
  revision: null,
  error: null,
  connecting: false,
})

const isDemo = computed(() => state.mode === 'demo')
const isLive = computed(() => state.mode === 'live')

function normalizeEndpoint(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  const url = new URL(trimmed)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Use an http:// or https:// Control API URL.')
  }
  return url.toString().replace(/\/$/, '')
}

async function connectToHop(endpoint: string, token: string) {
  state.connecting = true
  state.error = null

  try {
    const normalizedEndpoint = normalizeEndpoint(endpoint)
    const normalizedToken = token.trim()
    if (!normalizedToken) throw new Error('Enter the Bearer management token.')

    const controlApiBase = normalizedEndpoint === ''
      ? defaultControlApiBaseUrl
      : normalizedEndpoint.endsWith('/api/v1')
        ? normalizedEndpoint
        : `${normalizedEndpoint}/api/v1`
    const response = await fetch(`${controlApiBase}/status`, {
      headers: { Authorization: `Bearer ${normalizedToken}` },
    })

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const body = (await response.json()) as { message?: string }
        throw new Error(body.message ?? `Connection failed with HTTP ${response.status}.`)
      }
      const message = (await response.text()).trim()
      throw new Error(message || `Connection failed with HTTP ${response.status}.`)
    }

    const body = (await response.json()) as {
      version: string
      catalog_revision: number
    }
    state.endpoint = normalizedEndpoint
    state.token = normalizedToken
    state.insecureToken = normalizedToken === 'change-me'
    state.version = body.version
    state.revision = body.catalog_revision
    state.mode = 'live'
    window.sessionStorage.setItem(tokenKey, normalizedToken)
    if (normalizedEndpoint === '') {
      window.sessionStorage.removeItem(endpointKey)
    } else {
      window.sessionStorage.setItem(endpointKey, normalizedEndpoint)
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'The instance could not be reached.'
    throw error
  } finally {
    state.connecting = false
  }
}

async function restoreConnection() {
  const savedToken = window.sessionStorage.getItem(tokenKey) ?? ''
  if (!savedToken) return false

  try {
    await connectToHop(state.endpoint, savedToken)
    return true
  } catch {
    window.sessionStorage.removeItem(tokenKey)
    return false
  }
}

function useDemo() {
  window.sessionStorage.removeItem(tokenKey)
  state.mode = 'demo'
  state.token = ''
  state.insecureToken = false
  state.version = '0.2.1-demo'
  state.revision = 128
  state.error = null
}

function clearError() {
  state.error = null
}

function requireReauthentication() {
  window.sessionStorage.removeItem(tokenKey)
  state.mode = 'reauth'
  state.token = ''
  state.insecureToken = false
  state.version = null
  state.revision = null
}

function forgetInstance() {
  window.sessionStorage.removeItem(endpointKey)
  state.endpoint = ''
  useDemo()
}

export function getConnectionCredentials() {
  return {
    endpoint: state.endpoint,
    token: state.token,
    mode: state.mode,
  } as const
}

export function useConnection() {
  return {
    state: readonly(state),
    isDemo,
    isLive,
    connectToHop,
    restoreConnection,
    useDemo,
    clearError,
    requireReauthentication,
    forgetInstance,
  }
}
