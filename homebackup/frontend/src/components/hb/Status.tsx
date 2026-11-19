import { useTranslation } from 'react-i18next'
import type { Result } from '@/api/client'
import { cn } from '@/lib/utils'

const ICON: Record<Result, string> = {
  success: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M8 12.5l2.8 2.8L16.5 9.5',
  warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01',
  failure: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M15 9l-6 6 M9 9l6 6',
  running: 'M21 12a9 9 0 1 1-2.6-6.4 M21 4v5h-5',
}
export const FG: Record<Result, string> = { success: 'text-ok', warning: 'text-warn', failure: 'text-fail', running: 'text-run' }
const IC: Record<Result, string> = { success: 'text-ok-ic', warning: 'text-warn-ic', failure: 'text-fail-ic', running: 'text-run-ic' }
const BG: Record<Result, string> = { success: 'bg-ok-bg', warning: 'bg-warn-bg', failure: 'bg-fail-bg', running: 'bg-run-bg' }

export function StatusIcon({ status, size = 20, className }: { status: Result; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={cn('shrink-0', IC[status], className)}>
      <path d={ICON[status]} />
    </svg>
  )
}

export function StatusPill({ status }: { status: Result }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 justify-self-start rounded-full pr-3 pl-2.5 text-[13px] font-semibold', BG[status], FG[status])}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round"><path d={ICON[status]} /></svg>
      {t(`result.${status}`)}
    </span>
  )
}
