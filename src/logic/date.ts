export function localDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateFromLocal(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(value: string, amount: number): string {
  const date = dateFromLocal(value)
  date.setDate(date.getDate() + amount)
  return localDate(date)
}

export function diffDays(from: string, to: string): number {
  const a = dateFromLocal(from).getTime()
  const b = dateFromLocal(to).getTime()
  return Math.round((b - a) / 86400000)
}

/** 周一为一周起点 */
export function weekStart(value: string): string {
  const date = dateFromLocal(value)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return localDate(date)
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDate(value: string, withWeekday = true): string {
  const date = dateFromLocal(value)
  const base = `${date.getMonth() + 1}月${date.getDate()}日`
  return withWeekday ? `${base} ${WEEKDAYS[date.getDay()]}` : base
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function today(): string {
  return localDate()
}
