import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { Mark } from './Mark'

const SECTIONS = ['dashboard', 'history', 'targets', 'settings'] as const

export function AppHeader() {
  const { t } = useTranslation()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="hidden items-center gap-3 min-[600px]:flex">
        <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand text-white">
          <Mark />
        </span>
        <span className="font-heading text-[21px] font-bold tracking-[-0.01em]">HomeBackup</span>
      </div>
      <nav aria-label={t('nav.label')}
        className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-panel p-1">
        {SECTIONS.map((s) => (
          <NavLink key={s} to={s === 'dashboard' ? '/' : `/${s}`} end={s === 'dashboard'}
            className={({ isActive }) => cn(
              'flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-soft no-underline min-[600px]:px-[18px]',
              isActive ? 'bg-brand font-semibold text-white' : 'font-medium',
            )}>
            {t(`nav.${s}`)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
