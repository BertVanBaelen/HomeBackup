import i18n from '@/i18n'
import { bytes, dayLabel, duration, scheduleText } from './format'

const tz = 'Europe/Brussels'
const now = new Date('2026-11-10T14:09:00+01:00')
const at = (iso: string) => new Date(iso)

describe('english', () => {
  beforeAll(() => i18n.changeLanguage('en'))

  test('day labels as drawn in the design', () => {
    expect(dayLabel(at('2026-11-10T03:00:00+01:00'), now, tz)).toBe('Today, 03:00')
    expect(dayLabel(at('2026-11-11T14:00:00+01:00'), now, tz)).toBe('Tomorrow, 14:00')
    expect(dayLabel(at('2026-11-09T01:30:00+01:00'), now, tz)).toBe('Yesterday, 01:30')
    expect(dayLabel(at('2026-11-15T04:00:00+01:00'), now, tz)).toBe('Sun 15 Nov, 04:00')
    expect(dayLabel(at('2026-11-08T04:00:00+01:00'), now, tz, { time: false })).toBe('Sun 8 Nov')
  })

  test('bytes and durations', () => {
    expect(bytes(6.2 * 1024 ** 3)).toBe('6.2 GB')
    expect(bytes(18 * 1024 ** 2)).toBe('18 MB')
    expect(bytes(21.4 * 1024 ** 3)).toBe('21.4 GB')
    expect(bytes(412 * 1024 ** 3)).toBe('412 GB')
    expect(duration(42)).toBe('42 s')
    expect(duration(18 * 60)).toBe('18 min')
    expect(duration(107 * 60)).toBe('1 h 47 min')
  })

  test('schedule wording', () => {
    expect(scheduleText('0 3 * * *')).toBe('Daily at 03:00')
    expect(scheduleText('0 4 * * 0')).toBe('Sundays at 04:00')
    expect(scheduleText('0 5 1 * *')).toBe('1st of the month, 05:00')
    expect(scheduleText('*/15 * * * *')).toMatch(/15 minutes/)
  })
})

describe('dutch', () => {
  beforeAll(() => i18n.changeLanguage('nl'))
  afterAll(() => i18n.changeLanguage('en'))

  test('day labels and schedule in Dutch', () => {
    expect(dayLabel(at('2026-11-10T03:00:00+01:00'), now, tz)).toBe('Vandaag, 03:00')
    expect(dayLabel(at('2026-11-15T04:00:00+01:00'), now, tz)).toBe('zo 15 nov, 04:00')
    expect(scheduleText('0 3 * * *')).toBe('Dagelijks om 03:00')
    expect(bytes(6.2 * 1024 ** 3)).toBe('6,2 GB')
  })
})
