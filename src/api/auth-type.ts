import type { CredentialAuthType } from '@/domain'

import { HopApiError } from './errors'

export type WireCredentialAuthType = 'password' | 'key' | 'key+passphrase'
export type WireCredentialAuthTypeInput = 'password' | 'key' | 'key_passphrase'

export function credentialAuthTypeFromApi(value: WireCredentialAuthType): CredentialAuthType {
  if (value === 'key+passphrase') return 'key_passphrase'
  if (value === 'password' || value === 'key') return value

  throw new HopApiError(`Unsupported credential auth type: ${String(value)}`, {
    kind: 'invalid_response',
    code: 'invalid_response',
    status: 200,
  })
}

export function credentialAuthTypeToApi(
  value: CredentialAuthType,
): WireCredentialAuthTypeInput {
  return value
}
