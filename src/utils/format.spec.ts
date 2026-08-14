import { describe, expect, it } from 'vitest'

import { formatDuration, parseTimestamp, pluralize, shortFingerprint } from './format'

describe('format utilities', () => {
  it('treats SQLite timestamps without timezone as UTC', () => {
    expect(parseTimestamp('2026-08-14 09:41:22')?.toISOString()).toBe('2026-08-14T09:41:22.000Z')
  })

  it('formats durations and operational labels', () => {
    expect(formatDuration('2026-08-14T09:00:00Z', '2026-08-14T10:02:03Z')).toBe('01:02:03')
    expect(pluralize(1, 'session')).toBe('1 session')
    expect(pluralize(2, 'session')).toBe('2 sessions')
    expect(shortFingerprint('SHA256:abcdefghijklmnopqrstuvwxyz')).toBe('SHA256:abcde…stuvwxyz')
  })
})
