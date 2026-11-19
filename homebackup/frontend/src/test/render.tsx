import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import sample from './api-sample.json'

/** Serves the snapshot of real backend responses; POSTs are recorded in `calls`. */
export function mockApi() {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('api/v1/', '')
    if (init?.method === 'POST') calls.push(path)
    const body = (sample as Record<string, unknown>)[path] ?? {}
    return new Response(JSON.stringify(body), { status: 200 })
  }))
  return calls
}

export function renderPage(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
}
