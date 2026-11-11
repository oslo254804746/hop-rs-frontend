import { describe, expect, it } from 'vitest'

import { credentialAuthTypeFromApi, credentialAuthTypeToApi, HopApiError } from '@/api'
import {
  DEMO_HOP_API_CAPABILITIES,
  REMOTE_HOP_API_CAPABILITIES,
  type HopApiCapabilities,
} from '@/domain'

describe('Hop API domain boundary', () => {
  it('exposes converged v0.2.9 capabilities on remote and demo adapters', () => {
    expect(REMOTE_HOP_API_CAPABILITIES).toEqual({
      ownership: true,
      assetHealth: true,
      auditEvents: true,
    })
    expect(DEMO_HOP_API_CAPABILITIES).toEqual({
      ownership: true,
      assetHealth: true,
      auditEvents: true,
    })

    expect(() => {
      ;(REMOTE_HOP_API_CAPABILITIES as HopApiCapabilities).ownership = false
    }).toThrow(TypeError)
  })

  it('normalizes the asymmetric credential auth type values', () => {
    expect(credentialAuthTypeFromApi('password')).toBe('password')
    expect(credentialAuthTypeFromApi('key')).toBe('key')
    expect(credentialAuthTypeFromApi('key+passphrase')).toBe('key_passphrase')
    expect(credentialAuthTypeToApi('key_passphrase')).toBe('key_passphrase')
  })

  it('fails closed when a future server adds an unknown auth type', () => {
    expect(() => credentialAuthTypeFromApi('agent' as 'password')).toThrowError(HopApiError)
  })
})
