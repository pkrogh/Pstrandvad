const DAY = 24 * 60 * 60 * 1000

/** ISO date (YYYY-MM-DD) for today + offset days, in local time. */
export function isoFromToday(offsetDays: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return toIso(new Date(d.getTime() + offsetDays * DAY))
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function today(): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

export function daysUntil(iso: string): number {
  return daysBetween(today(), parseIso(iso))
}

/** Monday of the week containing d. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const dow = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - dow)
  r.setHours(12, 0, 0, 0)
  return r
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY)
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseIso(iso).toLocaleDateString('en-US', opts)
}

export function relativeDue(iso: string): string {
  const n = daysUntil(iso)
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (n === -1) return '1 day overdue'
  if (n < 0) return `${-n} days overdue`
  if (n < 7) return `Due in ${n} days`
  return `Due ${formatDate(iso)}`
}

export function timeAgo(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
