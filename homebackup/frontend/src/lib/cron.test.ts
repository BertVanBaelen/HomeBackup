import { parseCron, switchMode, toCron } from './cron'

test('friendly shapes round-trip', () => {
  for (const cron of ['15 * * * *', '0 3 * * *', '30 1 * * *', '0 4 * * 0', '0 6 * * 1,3,5', '0 5 1 * *']) {
    expect(toCron(parseCron(cron))).toBe(cron)
  }
  expect(parseCron('0 4 * * 0')).toEqual({ mode: 'weekly', time: '04:00', days: [0] })
  expect(parseCron('0 5 1 * *')).toEqual({ mode: 'monthly', time: '05:00', day: 1 })
})

test('everything else stays custom, untouched', () => {
  for (const cron of ['*/15 * * * *', '0 3 * 6 *', '0 3 31 * *', '0 0-6 * * *', 'nonsense']) {
    expect(parseCron(cron)).toEqual({ mode: 'custom', cron })
  }
})

test('switching mode keeps the time', () => {
  expect(toCron(switchMode(parseCron('30 1 * * *'), 'weekly'))).toBe('30 1 * * 0')
  expect(toCron(switchMode(parseCron('30 1 * * *'), 'monthly'))).toBe('30 1 1 * *')
  expect(switchMode(parseCron('0 4 * * 0'), 'custom')).toEqual({ mode: 'custom', cron: '0 4 * * 0' })
})
