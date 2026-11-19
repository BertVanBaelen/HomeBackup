import { Play, Plus, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  type ItemView, type Progress, type Status, type TargetView,
  useCancelRun, useItems, useRunNow, useStatus, useTargets,
} from '@/api/client'
import { HoldConfirm } from '@/components/hb/HoldConfirm'
import { RunStrip } from '@/components/hb/RunStrip'
import { FG, StatusIcon } from '@/components/hb/Status'
import { bytes, clock, dayLabel, duration, scheduleText } from '@/lib/format'
import { msg } from '@/lib/messages'

const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[18px] font-semibold no-underline'

export function Dashboard() {
  const { t } = useTranslation()
  const status = useStatus().data
  const items = useItems().data
  const targets = useTargets().data
  if (!status || !items || !targets) return <p className="text-faint">{t('common.loading')}</p>
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))
  const route = (i: ItemView) =>
    `${i.source} → ${targets.find((x: TargetView) => x.id === i.target_id)?.name ?? '?'}/${i.target_path}`

  return (
    <>
      {(status.running.length > 0 || status.attention.length > 0) && (
        <div className="flex flex-wrap gap-4">
          {status.running.map((p) => {
            const item = items.find((i) => i.last_run?.id === p.run_id)
            return item && <RunningCard key={p.run_id} p={p} item={item} route={route(item)} status={status} />
          })}
          {status.attention.map((a) => (
            <section key={a.item_id} aria-label={t('dashboard.attention')}
              className="flex min-w-0 flex-[2_1_280px] flex-col gap-3 rounded-[20px] border border-alert-line bg-alert-bg p-6">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.04em] text-fail uppercase">
                <StatusIcon status="failure" size={16} className="text-fail" />
                {t('dashboard.attention')}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 font-heading text-[22px] font-semibold text-alert-head">{byId[a.item_id]?.name}</h2>
                <span className="text-[15px] font-semibold text-alert-head">
                  {t('dashboard.no_success', { count: a.days_since_success })}
                </span>
              </div>
              <span className="text-alert-text">
                {dayLabel(new Date(a.last_run.started), new Date(status.now), status.time_zone)}
                {a.last_run.message && ` · ${msg(a.last_run.message)}.`}
              </span>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link to={`/runs/${a.last_run.id}`} className={`${pill} border border-alert-btn text-alert-head`}>
                  {t('dashboard.view_run')}
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="d-items-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="d-items-h" className="m-0 font-heading text-[22px] font-semibold tracking-[-0.01em]">
            {t('dashboard.items')}
          </h1>
          <Link to="/items/new" className={`${pill} bg-brand text-white`}>
            <Plus aria-hidden className="size-[18px]" />
            {t('dashboard.new_item')}
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div aria-hidden className={`${GRID} hidden border-b border-line px-5 py-3 text-xs font-semibold tracking-[0.04em] text-faint uppercase lg:grid`}>
            <span>{t('dashboard.col_item')}</span>
            <span>{t('dashboard.col_runs')}</span>
            <span>{t('dashboard.col_last')}</span>
            <span>{t('dashboard.col_next')}</span>
            <span />
          </div>
          <ul className="m-0 flex list-none flex-col gap-px bg-line p-0">
            {items.map((it) => <ItemRow key={it.id} it={it} route={route(it)} status={status} />)}
          </ul>
        </div>
      </section>
    </>
  )
}

const GRID = 'grid-cols-[minmax(0,1fr)_150px_210px_150px_96px] gap-4'

function RunningCard({ p, item, route, status }: { p: Progress; item: ItemView; route: string; status: Status }) {
  const { t } = useTranslation()
  const cancel = useCancelRun()
  const pct = Math.floor(p.percent)
  return (
    <section aria-label={t('dashboard.running_now')}
      className="flex min-w-0 flex-[3_1_380px] flex-col gap-4 rounded-[20px] bg-brand p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#d6efdd]">
        <span className="inline-flex items-center gap-2 font-semibold tracking-[0.04em] uppercase">
          <span aria-hidden className="size-2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.22)]" />
          {t('dashboard.running_now')}
        </span>
        <span>
          {t('dashboard.started', { time: clock(new Date(item.last_run!.started), status.time_zone) })}
          {' · '}{scheduleText(item.schedule).toLowerCase()}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-heading text-2xl font-semibold tracking-[-0.01em]">{item.name}</h2>
        <span className="font-mono text-[12.5px] text-[#d6efdd]">{route}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-heading text-[56px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{pct}%</span>
        <span className="text-[#e3f4e8]">
          {p.bytes_total === 0 ? t('dashboard.preparing') : t('dashboard.progress_detail', {
            done: bytes(p.bytes_done), total: bytes(p.bytes_total), speed: bytes(p.speed), eta: duration(p.eta_s),
          })}
        </span>
      </div>
      <div role="progressbar" aria-label={t('dashboard.progress_label', { name: item.name })}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${p.percent}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/runs/${p.run_id}`} className={`${pill} bg-white text-[#14532d]`}>{t('dashboard.live_log')}</Link>
        <HoldConfirm label={t('dashboard.cancel')} completeLabel={t('dashboard.cancelled')} icon={Square}
          onConfirm={() => cancel.mutate(p.run_id)}
          className="border-white/70 bg-transparent px-[18px] text-white hover:bg-white/10 data-complete:border-white data-complete:bg-white data-complete:text-brand" />
        {status.queue.length > 0 && (
          <span className="text-[13px] text-[#d6efdd]">{t('dashboard.queued_n', { count: status.queue.length })}</span>
        )}
      </div>
    </section>
  )
}

function ItemRow({ it, route, status }: { it: ItemView; route: string; status: Status }) {
  const { t } = useTranslation()
  const runNow = useRunNow()
  const cancel = useCancelRun()
  const now = new Date(status.now)
  const tz = status.time_zone
  const last = it.last_run
  const progress = last ? status.running.find((p) => p.run_id === last.id) : undefined
  const queued = status.queue.includes(it.id)
  const kind = it.type === 'rsync' ? t('kind.rsync')
    : it.immich_mode === 'full' ? t('kind.immich_full')
    : t('kind.immich_recent', { n: it.window, unit: t(`unit_short.${it.window_unit}`) })

  const state = progress ? 'running' : last?.status ?? 'success'
  const statusText = queued ? t('dashboard.queued')
    : progress ? t('dashboard.running_pct', { pct: Math.floor(progress.percent) })
    : last ? t(`result.${last.status}`) : '—'
  const started = last ? new Date(last.started) : undefined
  // The design shows a time only for recent runs ("Today, 03:00"); older ones read "Sun 8 Nov".
  const when = started && (progress
    ? t('dashboard.started', { time: clock(started, tz) }).toLowerCase()
    : dayLabel(started, now, tz, { time: +now - +started < 2 * 86_400_000 }))
  const detail = !last ? ''
    : progress ? `${bytes(progress.bytes_done)} / ${bytes(progress.bytes_total)}`
    : last.message ? msg(last.message, true)
    : last.ended && last.bytes != null
      ? `${duration((+new Date(last.ended) - +new Date(last.started)) / 1000)} · ${bytes(last.bytes)}` : ''
  const next = it.next_run ? dayLabel(new Date(it.next_run), now, tz) : t('dashboard.disabled')

  const actions = (
    <div className="flex shrink-0 justify-end gap-1">
      {progress ? (
        <HoldConfirm iconOnly icon={Square} label={t('dashboard.cancel_item', { name: it.name })}
          onConfirm={() => cancel.mutate(progress.run_id)} className="bg-fail-bg text-fail hover:bg-fail-bg" />
      ) : (
        <HoldConfirm iconOnly icon={Play} variant="green" label={t('dashboard.run_now', { name: it.name })}
          disabled={queued} onConfirm={() => runNow.mutate(it.id)}
          className="bg-soft-btn text-accent-ink hover:bg-soft-btn" />
      )}
    </div>
  )
  const name = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link to={`/items/${it.id}`} className="text-[15px] font-semibold text-foreground no-underline">{it.name}</Link>
      <span className="hidden text-xs text-faint lg:inline">{kind}</span>
      {it.delete && (
        <span className="inline-flex h-5 items-center rounded-full bg-warn-bg px-[7px] text-[11.5px] font-semibold text-warn">
          {t('dashboard.mirror')}
        </span>
      )}
    </div>
  )
  const lastLine = (
    <span>
      <strong className={queued ? 'text-run' : FG[state]}>{statusText}</strong>
      {when && <span className="text-soft"> · {when}</span>}
    </span>
  )

  return (
    <li className="bg-panel">
      {/* laptop: table row */}
      <div className={`${GRID} hidden items-center px-5 py-3 lg:grid`}>
        <div className="flex min-w-0 items-start gap-3">
          <StatusIcon status={state} className="mt-0.5" />
          <div className="flex min-w-0 flex-col gap-0.5">
            {name}
            <span className="truncate font-mono text-xs text-faint">{route}</span>
          </div>
        </div>
        <RunStrip results={it.recent} />
        <div className="flex min-w-0 flex-col gap-0.5">
          {lastLine}
          <span className="truncate text-[12.5px] text-faint">{detail}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span>{next}</span>
          <span className="text-[12.5px] text-faint">{scheduleText(it.schedule)}</span>
        </div>
        {actions}
      </div>
      {/* tablet and phone: stacked */}
      <div className="flex flex-col gap-2.5 py-3.5 pr-2 pl-4 lg:hidden">
        <div className="flex items-start gap-3">
          <StatusIcon status={state} className="mt-0.5" />
          <div className="flex min-w-0 flex-auto flex-col gap-0.5">
            {name}
            <span className="font-mono text-xs [overflow-wrap:anywhere] text-faint">{route}</span>
          </div>
          <div className="-mt-2">{actions}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 text-[13px]">
          <RunStrip results={it.recent} compact />
          {lastLine}
          <span className="text-faint">{t('dashboard.next', { when: next })}</span>
        </div>
      </div>
    </li>
  )
}
