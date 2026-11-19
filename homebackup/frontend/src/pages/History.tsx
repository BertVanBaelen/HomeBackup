import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { type Result, type RunSummary, type Status, useItems, useRuns, useSettings, useStatus } from '@/api/client'
import { StatusPill } from '@/components/hb/Status'
import { bytes, dayLabel, duration, number } from '@/lib/format'
import { msg } from '@/lib/messages'
import { cn } from '@/lib/utils'

const PAGE = 12
const FILTERS = [undefined, 'success', 'warning', 'failure', 'running'] as const
const GRID = 'grid-cols-[136px_minmax(0,1fr)_140px_110px_150px_minmax(0,1.2fr)_20px] gap-4'

export function History() {
  const { t } = useTranslation()
  const [itemId, setItemId] = useState<string>()
  const [result, setResult] = useState<Result>()
  const [limit, setLimit] = useState(PAGE)
  const items = useItems().data ?? []
  const settings = useSettings().data
  const status = useStatus().data
  const page = useRuns({ item_id: itemId, status: result, limit }).data
  const names = Object.fromEntries(items.map((i) => [i.id, i.name]))
  const all = page ? Object.values(page.counts).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">{t('history.title')}</h1>
        {settings && (
          <span className="text-faint">
            {t('history.retention', { runs: settings.keep_runs, days: settings.keep_days })}{' '}
            <Link to="/settings" className="font-semibold text-accent-ink">{t('history.change')}</Link>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex min-w-0 flex-[0_1_240px] flex-col gap-1">
          <span className="sr-only">{t('history.item')}</span>
          <select value={itemId ?? ''} onChange={(e) => { setItemId(e.target.value || undefined); setLimit(PAGE) }}
            className="min-h-11 w-full rounded-[10px] border border-field-line bg-field px-2.5 text-foreground">
            <option value="">{t('history.all_items')}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <div role="group" aria-label={t('history.filter')}
          className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-panel p-1">
          {FILTERS.map((f) => {
            const on = f === result
            return (
              <button key={f ?? 'all'} type="button" aria-pressed={on} onClick={() => { setResult(f); setLimit(PAGE) }}
                className={cn('min-h-11 shrink-0 rounded-full border-0 px-4 font-semibold',
                  on ? 'bg-brand text-white' : 'bg-transparent text-soft')}>
                {f ? t(`result.${f}`) : t('history.all')}{' '}
                <span className="font-medium">{f ? page?.counts[f] ?? '' : all}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div aria-hidden className={`${GRID} hidden border-b border-line px-5 py-3 text-xs font-semibold tracking-[0.04em] text-faint uppercase lg:grid`}>
          <span>{t('history.col_result')}</span><span>{t('history.col_item')}</span><span>{t('history.col_started')}</span>
          <span>{t('history.col_duration')}</span><span>{t('history.col_copied')}</span><span>{t('history.col_detail')}</span><span />
        </div>
        <ul className="m-0 flex list-none flex-col gap-px bg-line p-0">
          {page?.runs.map((r) => status && <RunRow key={r.id} r={r} name={names[r.item_id] ?? r.item_id} status={status} />)}
        </ul>
      </div>

      {page && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-faint">{t('history.showing', { shown: page.runs.length, total: page.total })}</span>
          {page.runs.length < page.total && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)}
              className="inline-flex min-h-11 items-center rounded-full border border-line2 bg-transparent px-5 font-semibold text-foreground">
              {t('history.more')}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function RunRow({ r, name, status }: { r: RunSummary; name: string; status: Status }) {
  const { t } = useTranslation()
  const now = new Date(status.now)
  const started = new Date(r.started)
  const live = status.running.find((p) => p.run_id === r.id)
  const secs = ((r.ended ? +new Date(r.ended) : +now) - +started) / 1000
  const dur = live ? t('history.so_far', { d: duration(secs) }) : duration(secs)
  const copied = live ? `${bytes(live.bytes_done)} / ${bytes(live.bytes_total)}`
    : r.bytes == null ? t('history.nothing')
    : t('history.files_size', { files: number(r.files ?? 0), size: bytes(r.bytes) })
  const detail = live ? `${Math.floor(live.percent)}%` : msg(r.message) || '—'
  const when = dayLabel(started, now, status.time_zone)
  const trigger = t(`trigger.${r.trigger}`)

  return (
    <li className="bg-panel">
      <Link to={`/runs/${r.id}`} className={`${GRID} hidden min-h-14 items-center px-5 py-2.5 text-inherit no-underline lg:grid`}>
        <StatusPill status={r.status} />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{name}</span>
          <span className="text-[12.5px] text-faint">{trigger}</span>
        </span>
        <span className="text-soft">{when}</span>
        <span className="text-soft">{dur}</span>
        <span className="text-soft">{copied}</span>
        <span className="text-soft">{detail}</span>
        <ChevronRight aria-hidden className="size-[18px] text-faint" />
      </Link>
      <Link to={`/runs/${r.id}`} className="flex min-h-14 flex-col gap-1.5 px-4 py-3.5 text-inherit no-underline lg:hidden">
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">{name}</span>
          <StatusPill status={r.status} />
        </span>
        <span className="text-[13px] text-faint">{when} · {trigger} · {dur}</span>
        <span className="text-soft">{r.message ? detail : copied}</span>
      </Link>
    </li>
  )
}
