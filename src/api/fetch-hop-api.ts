import {
  REMOTE_HOP_API_CAPABILITIES,
  type AccessKey,
  type ApplySummary,
  type Asset,
  type Credential,
  type HopApi,
  type RequestOptions,
  type Session,
  type TerminateSessionResult,
  type ValidationResult,
} from '@/domain'

import { errorFromResponse, HopApiError, toHopApiError } from './errors'
import {
  mapAccessKey,
  mapAccessKeyInput,
  mapApplyInput,
  mapApplySummary,
  mapAsset,
  mapAssetInput,
  mapCredential,
  mapCredentialInput,
  mapDiffInput,
  mapSession,
  mapStatus,
  mapValidateInput,
} from './mappers'
import type {
  WireAccessKey,
  WireApplySummary,
  WireAsset,
  WireCredential,
  WireRevisionResponse,
  WireSession,
  WireStatusResponse,
  WireTerminateResponse,
  WireValidationResponse,
} from './wire-types'

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface FetchHopApiOptions {
  /** Hop origin or a complete `/api/v1` base path. Empty means same-origin. */
  baseUrl: string
  token: string
  fetch?: FetchLike
}

interface HttpRequestOptions extends RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

function signalOptions(options?: RequestOptions): RequestOptions {
  return options?.signal === undefined ? {} : { signal: options.signal }
}

export function normalizeControlApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === '') return '/api/v1'
  if (trimmed.endsWith('/api/v1')) return trimmed
  return `${trimmed}/api/v1`
}

export function createFetchHopApi(options: FetchHopApiOptions): HopApi {
  const baseUrl = normalizeControlApiBaseUrl(options.baseUrl)
  const fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis)

  async function request<T>(path: string, optionsForRequest: HttpRequestOptions = {}): Promise<T> {
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${options.token}`,
    })
    const requestInit: RequestInit = {
      method: optionsForRequest.method ?? 'GET',
      headers,
    }

    if (optionsForRequest.signal !== undefined) requestInit.signal = optionsForRequest.signal
    if (optionsForRequest.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      requestInit.body = JSON.stringify(optionsForRequest.body)
    }

    let response: Response
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, requestInit)
    } catch (error) {
      throw toHopApiError(error)
    }

    if (response.status === 204) return undefined as T

    let rawBody: string
    try {
      rawBody = await response.text()
    } catch (error) {
      throw toHopApiError(error)
    }

    if (!response.ok) throw errorFromResponse(response, rawBody)
    if (rawBody.trim() === '') return undefined as T

    try {
      return JSON.parse(rawBody) as T
    } catch (error) {
      throw new HopApiError('The Hop Control API returned invalid JSON.', {
        kind: 'invalid_response',
        code: 'invalid_response',
        status: response.status,
        cause: error,
      })
    }
  }

  return {
    mode: 'remote',
    capabilities: REMOTE_HOP_API_CAPABILITIES,

    async getStatus(requestOptions) {
      return mapStatus(
        await request<WireStatusResponse>('/status', {
          ...signalOptions(requestOptions),
        }),
      )
    },

    async getRevision(requestOptions) {
      const response = await request<WireRevisionResponse>('/catalog/revision', {
        ...signalOptions(requestOptions),
      })
      return response.revision
    },

    async listAssets(requestOptions): Promise<Asset[]> {
      const response = await request<WireAsset[]>('/assets', signalOptions(requestOptions))
      return response.map(mapAsset)
    },

    async createAsset(input, requestOptions) {
      return mapAsset(
        await request<WireAsset>('/assets', {
          method: 'POST',
          body: mapAssetInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async updateAsset(id, input, requestOptions) {
      return mapAsset(
        await request<WireAsset>(`/assets/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: mapAssetInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async deleteAsset(id, requestOptions) {
      await request<void>(`/assets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        ...signalOptions(requestOptions),
      })
    },

    async listCredentials(requestOptions): Promise<Credential[]> {
      const response = await request<WireCredential[]>('/credentials', {
        ...signalOptions(requestOptions),
      })
      return response.map(mapCredential)
    },

    async createCredential(input, requestOptions) {
      return mapCredential(
        await request<WireCredential>('/credentials', {
          method: 'POST',
          body: mapCredentialInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async updateCredential(id, input, requestOptions) {
      return mapCredential(
        await request<WireCredential>(`/credentials/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: mapCredentialInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async deleteCredential(id, requestOptions) {
      await request<void>(`/credentials/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        ...signalOptions(requestOptions),
      })
    },

    async listAccessKeys(requestOptions): Promise<AccessKey[]> {
      const response = await request<WireAccessKey[]>('/access-keys', {
        ...signalOptions(requestOptions),
      })
      return response.map(mapAccessKey)
    },

    async createAccessKey(input, requestOptions) {
      return mapAccessKey(
        await request<WireAccessKey>('/access-keys', {
          method: 'POST',
          body: mapAccessKeyInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async setAccessKeyEnabled(id, enabled, requestOptions) {
      return mapAccessKey(
        await request<WireAccessKey>(`/access-keys/${encodeURIComponent(id)}/enabled`, {
          method: 'PUT',
          body: { enabled },
          ...signalOptions(requestOptions),
        }),
      )
    },

    async setAccessKeyAccess(id, assetIds, requestOptions) {
      return mapAccessKey(
        await request<WireAccessKey>(`/access-keys/${encodeURIComponent(id)}/access`, {
          method: 'PUT',
          body: { assets: assetIds },
          ...signalOptions(requestOptions),
        }),
      )
    },

    async deleteAccessKey(id, requestOptions) {
      await request<void>(`/access-keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        ...signalOptions(requestOptions),
      })
    },

    async listSessions(requestOptions): Promise<Session[]> {
      const response = await request<WireSession[]>('/sessions', {
        ...signalOptions(requestOptions),
      })
      return response.map(mapSession)
    },

    async terminateSession(id, requestOptions): Promise<TerminateSessionResult> {
      const response = await request<WireTerminateResponse>(
        `/sessions/${encodeURIComponent(id)}/terminate`,
        {
          method: 'POST',
          body: {},
          ...signalOptions(requestOptions),
        },
      )
      return { id: response.id, terminated: response.terminated }
    },

    async validateManifest(input, requestOptions): Promise<ValidationResult> {
      return request<WireValidationResponse>('/config/validate', {
        method: 'POST',
        body: mapValidateInput(input),
        ...signalOptions(requestOptions),
      })
    },

    async diffManifest(input, requestOptions): Promise<ApplySummary> {
      return mapApplySummary(
        await request<WireApplySummary>('/config/diff', {
          method: 'POST',
          body: mapDiffInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

    async applyManifest(input, requestOptions): Promise<ApplySummary> {
      return mapApplySummary(
        await request<WireApplySummary>('/config/apply', {
          method: 'POST',
          body: mapApplyInput(input),
          ...signalOptions(requestOptions),
        }),
      )
    },

  }
}
