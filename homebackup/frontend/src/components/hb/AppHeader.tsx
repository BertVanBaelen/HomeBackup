import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import SmoothTab from '@/components/kokonutui/smooth-tab'
import { Mark } from './Mark'

const SECTIONS = { dashboard: '/', history: '/history', targets: '/targets', settings: '/settings' } as const
type Section = keyof typeof SECTIONS

/** Which section a page belongs to: item and plan pages sit under Dashboard, run pages under History. */
function sectionOf(path: string): Section {
  const first = path.split('/')[1]
  if (first === 'runs' || first === 'history') return 'history'
  if (first === 'targets' || first === 'settings') return first
  return 'dashboard'
}

export function AppHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="hidden items-center gap-3 min-[600px]:flex">
        <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand text-white">
          <Mark />
        </span>
        <span className="font-heading text-[21px] font-bold tracking-[-0.01em]">HomeBackup</span>
      </div>
      {/* Kokonut swipe tabs, tab bar only: the indicator slides between sections. */}
      <SmoothTab
        tabsOnly
        label={t('nav.label')}
        value={sectionOf(pathname)}
        onChange={(id) => navigate(SECTIONS[id as Section])}
        items={(Object.keys(SECTIONS) as Section[]).map((id) => ({ id, title: t(`nav.${id}`) }))}
        className="w-auto max-w-full"
        listClassName="overflow-x-auto border border-line bg-panel"
        tabClassName="min-h-11 px-3.5 py-0 text-sm text-soft hover:text-foreground min-[600px]:px-[18px]"
        activeColor="bg-brand"
        activeTextColor="font-semibold text-white"
      />
    </header>
  )
}
