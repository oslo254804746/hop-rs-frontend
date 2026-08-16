import { computed, type ComputedRef } from 'vue'

import { createFetchHopApi, getPanelRuntimeConfig } from '@/api'
import { createDemoHopApi } from '@/demo'
import type { HopApi, HopApiCapabilities, HopApiMode } from '@/domain'
import { getConnectionCredentials, useConnection, type ConnectionMode } from '@/stores/connection'

const demoApi = createDemoHopApi()
const defaultControlApiBaseUrl = getPanelRuntimeConfig().controlApiBaseUrl

let remoteApi: HopApi | null = null
let remoteEndpoint = ''
let remoteToken = ''
let remoteSessionId = 0

function resolveRemoteApi(endpoint: string, token: string): HopApi {
  if (remoteApi === null || endpoint !== remoteEndpoint || token !== remoteToken) {
    remoteApi = createFetchHopApi({
      baseUrl: endpoint === '' ? defaultControlApiBaseUrl : endpoint,
      token,
    })
    remoteEndpoint = endpoint
    remoteToken = token
    remoteSessionId += 1
  }
  return remoteApi
}

function resolveApi(mode: ConnectionMode, endpoint: string, token: string): HopApi | null {
  if (mode === 'demo') return demoApi
  if (mode === 'live' && token !== '') return resolveRemoteApi(endpoint, token)
  return null
}

function scopeFor(mode: ConnectionMode, api: HopApi | null): string {
  if (mode === 'demo') return 'demo'
  if (api?.mode === 'remote') return `remote-${remoteSessionId}`
  return 'reauth'
}

export class HopApiUnavailableError extends Error {
  constructor() {
    super('Reconnect to the Hop instance before making this request.')
    this.name = 'HopApiUnavailableError'
  }
}

export function getHopApi(): HopApi {
  const connection = getConnectionCredentials()
  const api = resolveApi(connection.mode, connection.endpoint, connection.token)
  if (api === null) throw new HopApiUnavailableError()
  return api
}

export interface HopApiRuntime {
  api: ComputedRef<HopApi | null>
  capabilities: ComputedRef<Readonly<HopApiCapabilities> | null>
  mode: ComputedRef<HopApiMode | 'reauth'>
  ready: ComputedRef<boolean>
  scope: ComputedRef<string>
  requireApi: () => HopApi
}

export function useHopApiRuntime(): HopApiRuntime {
  const connection = useConnection()
  const api = computed(() =>
    resolveApi(connection.state.mode, connection.state.endpoint, connection.state.token),
  )
  const mode = computed<HopApiMode | 'reauth'>(() => {
    if (connection.state.mode === 'reauth') return 'reauth'
    return connection.state.mode === 'demo' ? 'demo' : 'remote'
  })
  const ready = computed(() => api.value !== null)
  const scope = computed(() => scopeFor(connection.state.mode, api.value))
  const capabilities = computed(() => api.value?.capabilities ?? null)

  function requireApi(): HopApi {
    if (api.value === null) throw new HopApiUnavailableError()
    return api.value
  }

  return { api, capabilities, mode, ready, scope, requireApi }
}
