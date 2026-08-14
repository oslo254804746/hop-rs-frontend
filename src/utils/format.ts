export function parseTimestamp(value: string | null): Date | null {
  if (value === null) return null
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
export function formatTimestamp(value: string | null): string {
  const date = parseTimestamp(value)
  if (date === null) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRelativeTime(value: string | null, now = new Date()): string {
  const date = parseTimestamp(value)
  if (date === null) return 'Unknown'

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const absoluteSeconds = Math.abs(seconds)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (absoluteSeconds < 60) return formatter.format(seconds, 'second')
  if (absoluteSeconds < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (absoluteSeconds < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86_400), 'day')
}

export function formatDuration(start: string | null, end: string | null): string {
  const startDate = parseTimestamp(start)
  if (startDate === null) return '—'
  const endDate = parseTimestamp(end) ?? new Date()
  const seconds = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function shortFingerprint(value: string): string {
  if (value.length <= 24) return value
  return `${value.slice(0, 12)}…${value.slice(-8)}`
}
