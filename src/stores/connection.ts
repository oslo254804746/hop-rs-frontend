import { computed, reactive, readonly } from 'vue'

export type ConnectionMode = 'demo' | 'live' | 'reauth'

interface ConnectionState {
  mode: ConnectionMode
  endpoint: string
  token: string
  version: string | null
  revision: number | null
  error: string | null
  connecting: boolean
}

const endpointKey = 'hop.control-api-url'
const savedEndpoint = window.sessionStorage.getItem(endpointKey) ?? ''

const state = reactive<ConnectionState>({
  mode: savedEndpoint ? 'reauth' : 'demo',
  endpoint: savedEndpoint,
  token: '',
  version: null,
  revision: null,
  error: null,
  connecting: false,
})

const isDemo = computed(() => state.mode === 'demo')
const isLive = computed(() => state.mode === 'live')

function normalizeEndpoint(value: string) {
  const url = new URL(value.trim())
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

    const controlApiBase = normalizedEndpoint.endsWith('/api/v1')
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
    state.version = body.version
    state.revision = body.catalog_revision
    state.mode = 'live'
    window.sessionStorage.setItem(endpointKey, normalizedEndpoint)
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'The instance could not be reached.'
    throw error
  } finally {
    state.connecting = false
  }
}

function useDemo() {
  state.mode = 'demo'
  state.token = ''
  state.version = '0.2.0-demo'
  state.revision = 128
  state.error = null
}

function requireReauthentication() {
  state.mode = state.endpoint ? 'reauth' : 'demo'
  state.token = ''
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
    useDemo,
    requireReauthentication,
    forgetInstance,
  }
}
