import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from './schema'

type S = components['schemas']
export type ItemView = S['ItemView']
export type RunSummary = S['RunSummary']
export type Status = S['Status']
export type Progress = S['Progress']
export type RunPage = S['RunPage']
export type TargetView = S['TargetView']
export type Settings = S['Settings']
export type Result = RunSummary['status']
export type Message = S['Message']

// Relative URLs: the app lives under HA's Ingress token path, which we never need to know.
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`api/v1/${path}`, init)
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const useStatus = () => useQuery({ queryKey: ['status'], queryFn: () => call<Status>('status'), refetchInterval: 15_000 })
export const useItems = () => useQuery({ queryKey: ['items'], queryFn: () => call<ItemView[]>('items'), refetchInterval: 30_000 })
export const useTargets = () => useQuery({ queryKey: ['targets'], queryFn: () => call<TargetView[]>('targets') })
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => call<Settings>('settings') })

export function useRuns(params: { item_id?: string; status?: Result; limit: number }) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  return useQuery({ queryKey: ['runs', params], queryFn: () => call<RunPage>(`runs?${q}`), placeholderData: (prev) => prev })
}

function useInvalidating<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries() })
}

export const useRunNow = () => useInvalidating((itemId: string) => call(`items/${itemId}/run`, { method: 'POST' }))
export const useCancelRun = () => useInvalidating((runId: string) => call(`runs/${runId}/cancel`, { method: 'POST' }))

/** Live progress over SSE, merged into the cached status; the status query's polling is the fallback. */
export function useLiveProgress() {
  const qc = useQueryClient()
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const es = new EventSource('api/v1/events')
    es.addEventListener('progress', (e) => {
      const p = JSON.parse((e as MessageEvent).data) as Progress
      qc.setQueryData<Status>(['status'], (s) => {
        if (!s) return s
        if (!s.running.some((r) => r.run_id === p.run_id)) {
          void qc.invalidateQueries() // a new run started or one finished: refresh everything
          return s
        }
        return { ...s, running: s.running.map((r) => (r.run_id === p.run_id ? p : r)) }
      })
    })
    return () => es.close()
  }, [qc])
}
