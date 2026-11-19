import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import sample from './api-sample.json'

export const api = sample as Record<string, unknown>

/**
 * Serves the snapshot of real backend responses (see api-sample.json): GET by path, POST by "POST path".
 * Writes (POST/PUT/DELETE) are recorded in `calls` as "METHOD path" with their JSON body.
 */
export function mockApi(overrides: Record<string, unknown> = {}) {
  const calls: { call: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('api/v1/', '')
    const method = init?.method ?? 'GET'
    const key = method === 'GET' ? path : `${method} ${path.split('?')[0]}`
    if (method !== 'GET') calls.push({ call: `${method} ${path}`, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const all = { ...api, ...overrides }
    if (method === 'DELETE') return new Response(null, { status: 204 })
    const body = key in all ? all[key] : method === 'GET' ? null : JSON.parse(String(init?.body ?? '{}'))
    return new Response(JSON.stringify(body), { status: body === null ? 404 : 200 })
  }))
  return calls
}

/** Renders a page inside the app's providers; `path`/`url` set the route (e.g. '/items/:id', '/items/it5'). */
export function renderPage(ui: ReactNode, { path = '/', url = '/' }: { path?: string; url?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>navigated away</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
