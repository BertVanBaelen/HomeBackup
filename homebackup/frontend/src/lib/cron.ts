/** The schedule shapes the friendly picker offers; anything else stays a custom cron expression. */
export type Schedule =
  | { mode: 'hourly'; minute: number }
  | { mode: 'daily'; time: string }
  | { mode: 'weekly'; time: string; days: number[] } // 0 = Sunday
  | { mode: 'monthly'; time: string; day: number }
  | { mode: 'custom'; cron: string }

const num = /^\d+$/
const hhmm = (h: string, m: string) => `${h.padStart(2, '0')}:${m.padStart(2, '0')}`

export function parseCron(cron: string): Schedule {
  const f = cron.trim().split(/\s+/)
  if (f.length !== 5 || !num.test(f[0]) || +f[0] > 59) return { mode: 'custom', cron }
  const [m, h, dom, mon, dow] = f
  if (mon !== '*') return { mode: 'custom', cron }
  if (h === '*' && dom === '*' && dow === '*') return { mode: 'hourly', minute: +m }
  if (!num.test(h) || +h > 23) return { mode: 'custom', cron }
  const time = hhmm(h, m)
  if (dom === '*' && dow === '*') return { mode: 'daily', time }
  if (dom === '*' && /^[0-6](,[0-6])*$/.test(dow)) return { mode: 'weekly', time, days: [...new Set(dow.split(',').map(Number))].sort() }
  if (num.test(dom) && +dom >= 1 && +dom <= 28 && dow === '*') return { mode: 'monthly', time, day: +dom }
  return { mode: 'custom', cron }
}

export function toCron(s: Schedule): string {
  if (s.mode === 'custom') return s.cron
  if (s.mode === 'hourly') return `${s.minute} * * * *`
  const [h, m] = s.time.split(':').map(Number)
  if (s.mode === 'daily') return `${m} ${h} * * *`
  if (s.mode === 'weekly') return `${m} ${h} * * ${(s.days.length ? s.days : [0]).join(',')}`
  return `${m} ${h} ${s.day} * *`
}

/** Switching mode keeps the time the user already picked. */
export function switchMode(s: Schedule, mode: Schedule['mode']): Schedule {
  const time = 'time' in s ? s.time : '03:00'
  switch (mode) {
    case 'hourly': return { mode, minute: 'minute' in s ? s.minute : 0 }
    case 'daily': return { mode, time }
    case 'weekly': return { mode, time, days: 'days' in s ? s.days : [0] }
    case 'monthly': return { mode, time, day: 'day' in s ? s.day : 1 }
    case 'custom': return { mode, cron: toCron(s) }
  }
}
