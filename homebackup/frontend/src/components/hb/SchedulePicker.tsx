import { useTranslation } from 'react-i18next'
import { type Schedule, parseCron, switchMode, toCron } from '@/lib/cron'
import { cn } from '@/lib/utils'

const MODES = ['hourly', 'daily', 'weekly', 'monthly', 'custom'] as const
const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first
const field = 'min-h-11 rounded-[10px] border border-field-line bg-field px-3 text-foreground'

/** Friendly schedule: radio buttons for the common shapes, raw cron only for "Custom". Emits a cron string. */
export function SchedulePicker({ value, onChange, invalid }: { value: string; onChange: (cron: string) => void; invalid?: boolean }) {
  const { t } = useTranslation()
  const s = parseCron(value)
  const set = (next: Schedule) => onChange(toCron(next))

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] font-semibold text-soft">{t('schedule.label')}</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <label key={m} className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-[#3b82f6]',
              s.mode === m ? 'border-brand bg-accent text-accent-foreground' : 'border-line bg-panel text-soft',
            )}>
              <input type="radio" name="schedule-mode" value={m} checked={s.mode === m} className="accent-brand"
                onChange={() => set(switchMode(s, m))} />
              {t(`schedule.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {s.mode === 'hourly' && (
        <label className="flex items-center gap-3">
          <span className="text-soft">{t('schedule.minute')}</span>
          <input type="number" min={0} max={59} value={s.minute} className={cn(field, 'w-24')}
            onChange={(e) => set({ ...s, minute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })} />
        </label>
      )}

      {s.mode === 'weekly' && (
        <div role="group" aria-label={t('schedule.days')} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-soft">{t('schedule.days')}</span>
          {WEEK.map((d) => {
            const on = s.days.includes(d)
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={t(`schedule.weekday_long.${d}`)}
                // at least one day stays selected
                onClick={() => set({ ...s, days: on ? (s.days.length > 1 ? s.days.filter((x) => x !== d) : s.days) : [...s.days, d].sort() })}
                className={cn('size-11 rounded-full border text-sm font-semibold',
                  on ? 'border-brand bg-brand text-white' : 'border-line bg-panel text-soft')}>
                {t(`schedule.weekday_short.${d}`)}
              </button>
            )
          })}
        </div>
      )}

      {s.mode === 'monthly' && (
        <label className="flex items-center gap-3">
          <span className="text-soft">{t('schedule.day')}</span>
          <input type="number" min={1} max={28} value={s.day} className={cn(field, 'w-20')}
            onChange={(e) => set({ ...s, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
          <span className="text-soft">{t('schedule.of_month')}</span>
        </label>
      )}

      {(s.mode === 'daily' || s.mode === 'weekly' || s.mode === 'monthly') && (
        <label className="flex items-center gap-3">
          <span className="text-soft">{t('schedule.time')}</span>
          <input type="time" value={s.time} required className={cn(field, 'w-32')}
            onChange={(e) => e.target.value && set({ ...s, time: e.target.value })} />
        </label>
      )}

      {s.mode === 'custom' && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-soft">{t('schedule.cron')}</span>
          <input value={s.cron} aria-invalid={invalid || undefined} spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={cn(field, 'font-mono aria-invalid:border-fail')} />
          <span className="text-[12.5px] text-faint">{t('schedule.cron_hint')}</span>
        </label>
      )}
    </div>
  )
}
