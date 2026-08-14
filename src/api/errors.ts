export type HopApiErrorKind = 'http' | 'network' | 'invalid_response' | 'aborted'

export interface HopApiErrorOptions {
  kind: HopApiErrorKind
  code: string
  status: number | null
  path?: string | undefined
  retryable?: boolean | undefined
  cause?: unknown
}

export class HopApiError extends Error {
  readonly kind: HopApiErrorKind
  readonly code: string
  readonly status: number | null
  readonly path?: string
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(message: string, options: HopApiErrorOptions) {
    super(message)
    this.name = 'HopApiError'
    this.kind = options.kind
    this.code = options.code
    this.status = options.status
    this.retryable = options.retryable ?? false
    if (options.path !== undefined) this.path = options.path
    if (options.cause !== undefined) this.cause = options.cause
  }
}

export function isHopApiError(error: unknown): error is HopApiError {
  return error instanceof HopApiError
}

export function toHopApiError(error: unknown): HopApiError {
  if (isHopApiError(error)) return error

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new HopApiError('The request was cancelled.', {
      kind: 'aborted',
      code: 'request_aborted',
      status: null,
      cause: error,
    })
  }

  return new HopApiError('Could not reach the Hop Control API.', {
    kind: 'network',
    code: 'network_error',
    status: null,
    retryable: true,
    cause: error,
  })
}

interface ErrorBodyCandidate {
  code?: unknown
  path?: unknown
  message?: unknown
}

export function errorFromResponse(response: Response, rawBody: string): HopApiError {
  const candidate = parseErrorCandidate(rawBody)
  const code = typeof candidate?.code === 'string' ? candidate.code : `http_${response.status}`
  const path = typeof candidate?.path === 'string' ? candidate.path : undefined
  const message =
    typeof candidate?.message === 'string'
      ? candidate.message
      : rawBody.trim() || response.statusText || `Hop API request failed (${response.status}).`

  return new HopApiError(message, {
    kind: 'http',
    code,
    status: response.status,
    path,
    retryable: response.status === 429 || response.status >= 500,
  })
}

function parseErrorCandidate(rawBody: string): ErrorBodyCandidate | null {
  if (rawBody.trim() === '') return null

  try {
    const value: unknown = JSON.parse(rawBody)
    return typeof value === 'object' && value !== null ? (value as ErrorBodyCandidate) : null
  } catch {
    return null
  }
}
