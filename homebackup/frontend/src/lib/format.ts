import cronstrue from 'cronstrue/i18n'
import i18n from '@/i18n'

const lang = () => (i18n.language === 'nl' ? 'nl-BE' : 'en-GB')
const t = (key: string, opts: Record<string, unknown> = {}) => i18n.t(key, opts) as string

/** Calendar date (y-m-d) of `d` in time zone `tz`, as a comparable number of days. */
function dayIndex(d: Date, tz: string) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).split('-').map(Number)
  return Date.UTC(y, m - 1, day) / 86_400_000
}

export function clock(d: Date, tz: string) {
  return new Intl.DateTimeFormat(lang(), { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** "Today, 03:00", "Tomorrow, 14:00", "Sun 15 Nov, 04:00"; relative to the server's `now` in HA's time zone. */
export function dayLabel(d: Date, now: Date, tz: string, { time = true } = {}) {
  const diff = dayIndex(d, tz) - dayIndex(now, tz)
  const rel = ({ [-1]: 'day.yesterday', 0: 'day.today', 1: 'day.tomorrow' } as Record<number, string>)[diff]
  const day = rel
    ? t(rel)
    : new Intl.DateTimeFormat(lang(), { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })
        .format(d).replace(/[.,]/g, '')
  return time ? `${day}, ${clock(d, tz)}` : day
}

export function bytes(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  const num = new Intl.NumberFormat(lang(), { maximumFractionDigits: n < 100 && i > 0 ? 1 : 0 }).format(n)
  return `${num} ${units[i]}`
}

export function number(n: number) {
  return new Intl.NumberFormat(lang()).format(n)
}

export function duration(s: number) {
  if (s < 60) return t('dur.s', { n: Math.round(s) })
  const m = Math.round(s / 60)
  if (m < 60) return t('dur.min', { n: m })
  return t('dur.h_min', { h: Math.floor(m / 60), m: m % 60 })
}

/** Plain wording for the common cron shapes the design uses; anything else goes through cronstrue. */
export function scheduleText(cron: string) {
  const f = cron.trim().split(/\s+/)
  const simple = /^\d+$/
  if (f.length === 5 && simple.test(f[0]) && simple.test(f[1])) {
    const hhmm = `${f[1].padStart(2, '0')}:${f[0].padStart(2, '0')}`
    const [, , dom, mon, dow] = f
    if (dom === '*' && mon === '*' && dow === '*') return t('sched.daily', { time: hhmm })
    if (dom === '*' && mon === '*' && /^[0-6]$/.test(dow)) return t('sched.weekly', { day: t(`weekdays.${dow}`), time: hhmm })
    if (simple.test(dom) && mon === '*' && dow === '*') return t('sched.monthly', { day: t('ordinal', { count: Number(dom), ordinal: true }), time: hhmm })
  }
  return cronstrue.toString(cron, { locale: i18n.language, use24HourTimeFormat: true })
}
