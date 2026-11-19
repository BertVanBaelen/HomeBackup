import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from './schema'

type S = components['schemas']
export type Item = S['Item']
export type ItemView = S['ItemView']
export type ItemCheck = S['ItemCheck']
export type RunSummary = S['RunSummary']
export type RunDetail = S['RunDetail']
export type RunWithLog = S['RunWithLog']
export type StepResult = S['StepResult']
export type Step = S['Step']
export type LogLine = S['LogLine']
export type Plan = S['Plan']
export type Status = S['Status']
export type Progress = S['Progress']
export type RunPage = S['RunPage']
export type Target = S['Target']
export type TargetIn = S['TargetIn']
export type TargetView = S['TargetView']
export type TargetTest = S['TargetTest']
export type Device = S['Device']
export type Settings = S['Settings']
export type ConfigStatus = S['ConfigStatus']
export type BackupType = S['BackupType']
export type Result = RunSummary['status']
export type Message = S['Message']

/** A failed API call; `detail` is FastAPI's error body (a string, or a list of field errors for 422). */
export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

// Relative URLs: the app lives under HA's Ingress token path, which we never need to know.
async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(`api/v1/${path}`, json === undefined ? rest : {
    ...rest, body: JSON.stringify(json), headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? body)
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>
}

/** Field errors from a 422, keyed by field name: `{ schedule: 'Value error, ...' }`. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !Array.isArray(e.detail)) return {}
  return Object.fromEntries(e.detail.map((d: { loc: (string | number)[]; msg: string }) => [String(d.loc.at(-1)), d.msg]))
}

// --- reads -----------------------------------------------------------------------------
export const useStatus = () => useQuery({ queryKey: ['status'], queryFn: () => call<Status>('status'), refetchInterval: 5_000 })
export const useItems = () => useQuery({ queryKey: ['items'], queryFn: () => call<ItemView[]>('items'), refetchInterval: 15_000 })
export const useItem = (id: string | undefined) =>
  useQuery({ queryKey: ['item', id], queryFn: () => call<Item>(`items/${id}`), enabled: !!id })
export const usePlan = (id: string | undefined) =>
  useQuery({ queryKey: ['plan', id], queryFn: () => call<Plan>(`items/${id}/plan`), enabled: !!id })
export const useTargets = () => useQuery({ queryKey: ['targets'], queryFn: () => call<TargetView[]>('targets') })
export const useDevices = () => useQuery({ queryKey: ['devices'], queryFn: () => call<Device[]>('devices') })
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => call<Settings>('settings') })
export const useConfigStatus = () => useQuery({ queryKey: ['config'], queryFn: () => call<ConfigStatus>('config') })
export const useTypes = () => useQuery({ queryKey: ['types'], queryFn: () => call<BackupType[]>('types') })
export const useScripts = () => useQuery({ queryKey: ['scripts'], queryFn: () => call<string[]>('scripts') })

export function useRuns(params: { item_id?: string; status?: Result; limit: number }) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  return useQuery({ queryKey: ['runs', params], queryFn: () => call<RunPage>(`runs?${q}`), placeholderData: (prev) => prev })
}

/** A run with its steps and log; polls while it is still running. */
export const useRun = (id: string | undefined) => useQuery({
  queryKey: ['run', id], queryFn: () => call<RunWithLog>(`runs/${id}`), enabled: !!id,
  refetchInterval: (q) => (q.state.data?.run.status === 'running' ? 2_000 : false),
})

/** Checks and schedule preview for unsaved editor values (nothing is stored). */
export const useItemCheck = (item: Item | undefined) => useQuery({
  queryKey: ['check', item], queryFn: () => call<ItemCheck>('items/check', { method: 'POST', json: item }),
  enabled: !!item, placeholderData: (prev) => prev,
})

// --- writes ------------------------------------------------------------------------------
function useInvalidating<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries() })
}

export const useRunNow = () => useInvalidating((itemId: string) => call<Status>(`items/${itemId}/run`, { method: 'POST' }))
export const useDryRun = () =>
  useInvalidating((itemId: string) => call<Status>(`items/${itemId}/run?dry_run=true`, { method: 'POST' }))
export const useCancelRun = () => useInvalidating((runId: string) => call<Status>(`runs/${runId}/cancel`, { method: 'POST' }))

export const useSaveItem = () => useInvalidating((item: Item) =>
  item.id ? call<Item>(`items/${item.id}`, { method: 'PUT', json: item }) : call<Item>('items', { method: 'POST', json: item }))
export const useDeleteItem = () => useInvalidating((id: string) => call<void>(`items/${id}`, { method: 'DELETE' }))

export const useSaveTarget = () => useInvalidating((t: TargetIn) =>
  t.id ? call<Target>(`targets/${t.id}`, { method: 'PUT', json: t }) : call<Target>('targets', { method: 'POST', json: t }))
export const useDeleteTarget = () => useInvalidating((id: string) => call<void>(`targets/${id}`, { method: 'DELETE' }))
export const useTestTarget = () => useMutation({ mutationFn: (t: TargetIn) => call<TargetTest>('targets/test', { method: 'POST', json: t }) })

export const useSaveSettings = () => useInvalidating((s: Settings) => call<Settings>('settings', { method: 'PUT', json: s }))
export const useCheckConfig = () => useInvalidating(() => call<ConfigStatus>('config/check', { method: 'POST' }))
export const useRefreshTypes = () => useInvalidating(() => call<BackupType[]>('types/refresh', { method: 'POST' }))

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
