import { useTranslation } from 'react-i18next'
import type { Result } from '@/api/client'

const BAR = { success: ['bg-bar-ok', 22, 18], warning: ['bg-bar-warn', 15, 12], failure: ['bg-bar-fail', 8, 6] } as const
const KEY = { success: 'runs_s', warning: 'runs_w', failure: 'runs_f' } as const

/** Last finished runs as bars, oldest first; height and color both encode the result. */
export function RunStrip({ results, compact = false }: { results: Result[]; compact?: boolean }) {
  const { t } = useTranslation()
  const done = results.filter((r): r is keyof typeof BAR => r !== 'running')
  const parts = (['success', 'warning', 'failure'] as const)
    .map((r) => [r, done.filter((d) => d === r).length] as const)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => t(`dashboard.${KEY[r]}`, { count: n }))
  return (
    <div role="img" aria-label={t('dashboard.runs_label', { n: done.length, parts: parts.join(', ') })}
      className={compact ? 'flex h-[18px] items-end gap-[3px]' : 'flex h-[22px] items-end gap-[3px]'}>
      {done.map((r, i) => (
        <span key={i} className={`${BAR[r][0]} rounded-[2px] ${compact ? 'w-1.5' : 'w-[7px]'}`}
          style={{ height: BAR[r][compact ? 2 : 1] }} />
      ))}
    </div>
  )
}
