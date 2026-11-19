import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { useSettings } from '@/api/client'
import { AppHeader, SECTIONS, sectionOf } from '@/components/hb/AppHeader'
import i18n from '@/i18n'
import { resolveLanguage, useHaEnv } from '@/lib/ha'
import { Dashboard } from '@/pages/Dashboard'
import { History } from '@/pages/History'
import { ItemEditor } from '@/pages/ItemEditor'
import { PlanPreview } from '@/pages/PlanPreview'
import { RunDetail } from '@/pages/RunDetail'
import { Settings } from '@/pages/Settings'
import { Targets } from '@/pages/Targets'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: true } } })

/** Theme and language follow Home Assistant; the Settings language overrides HA's. */
function useHaSync() {
  const env = useHaEnv()
  const setting = useSettings().data?.language ?? 'auto'
  useEffect(() => { document.documentElement.classList.toggle('dark', env.dark) }, [env.dark])
  useEffect(() => {
    const lng = resolveLanguage(setting, env.language)
    void i18n.changeLanguage(lng)
    document.documentElement.lang = lng
  }, [setting, env.language])
}

function ComingSoon() {
  const { t } = useTranslation()
  return <p className="text-faint">{t('common.coming')}</p>
}

const ORDER = Object.keys(SECTIONS)
const slide = {
  enter: (dir: number) => ({ x: dir * 64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -64, opacity: 0 }),
}

/** Switching section slides the page in from the side of the tab you picked; pages within a section just swap. */
function SlidingRoutes() {
  const location = useLocation()
  const section = sectionOf(location.pathname)
  const prev = useRef(section)
  const dir = ORDER.indexOf(section) >= ORDER.indexOf(prev.current) ? 1 : -1
  useEffect(() => { prev.current = section }, [section])
  return (
    <div className="overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div key={section} custom={dir} variants={slide} initial="enter" animate="center" exit="exit"
          transition={{ type: 'spring', stiffness: 420, damping: 38 }} className="flex flex-col gap-6">
          <Routes location={location}>
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="items/new" element={<ItemEditor />} />
            <Route path="items/:id" element={<ItemEditor />} />
            <Route path="items/:id/plan" element={<PlanPreview />} />
            <Route path="runs/:id" element={<RunDetail />} />
            <Route path="targets" element={<Targets />} />
            <Route path="targets/:id" element={<Targets />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<ComingSoon />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Shell() {
  useHaSync()
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-[clamp(16px,4vw,32px)] pt-5 pb-10">
        <AppHeader />
        <SlidingRoutes />
      </div>
    </MotionConfig>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* HashRouter: the route survives a frame reload and never depends on HA's Ingress token path. */}
      <HashRouter>
        <Shell />
      </HashRouter>
    </QueryClientProvider>
  )
}
