import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Route, Routes } from 'react-router'
import { useSettings } from '@/api/client'
import { AppHeader } from '@/components/hb/AppHeader'
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

function Shell() {
  useHaSync()
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-[clamp(16px,4vw,32px)] pt-5 pb-10">
      <AppHeader />
      <Routes>
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
    </div>
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
