import { ArrowLeft, ChevronDown, Search, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import {
  ApiError, type LogLine, type RunDetail as Run, type StepResult,
  useCancelRun, useItems, useRun, useStatus, useTypes,
} from '@/api/client'
import { HoldConfirm } from '@/components/hb/HoldConfirm'
import { Segmented } from '@/components/hb/Segmented'
import { FG, StatusPill } from '@/components/hb/Status'
import i18n from '@/i18n'
import { bytes, clock, duration, number } from '@/lib/format'
import { msg } from '@/lib/messages'
import { cn } from '@/lib/utils'

const LEVEL: Record<LogLine['level'], string> = { INFO: 'text-faint', CMD: 'text-accent-ink', WARN: 'text-warn', ERROR: 'text-fail' }
const FILTERS = { all: () => true, warn: (l: LogLine) => l.level === 'WARN', error: (l: LogLine) => l.level === 'ERROR' }
const MONO = 'rounded-[10px] border border-line bg-background px-3 py-2.5 font-mono text-[12.5px] leading-[1.55]'
const isWarnLine = (s: string) => /vanished|warning/i.test(s)

function fullDate(d: Date, tz: string) {
  const day = new Intl.DateTimeFormat(i18n.language === 'nl' ? 'nl-BE' : 'en-GB',
    { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/[.,]/g, '')
  return `${day}, ${clock(d, tz)}`
}

export function RunDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const q = useRun(id)
  const status = useStatus().data
  const items = useItems().data ?? []
  const types = useTypes().data ?? []

  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <div className="flex flex-col items-start gap-2">
        <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">{t('run.not_found')}</h1>
        <Link to="/history" className="inline-flex min-h-11 items-center font-semibold text-accent-ink">{t('run.back_history')}</Link>
      </div>
    )
  }
  if (!q.data || !status) return null

  const { run, log } = q.data
  const tz = status.time_zone
  const item = items.find((i) => i.id === run.item_id)
  const typeName = (id: string) => types.find((x) => x.id === id)?.name ?? id
  const started = new Date(run.started)
  const end = run.ended ? new Date(run.ended) : new Date(status.now)
  const secs = (+end - +started) / 1000
  const live = status.running.find((p) => p.run_id === run.id)
  const running = run.status === 'running'

  const tiles = [
    { label: t('run.result'), value: t(`result.${run.status}`), sub: run.exit_code != null ? t('run.exit_code', { code: run.exit_code }) : '', color: FG[run.status] },
    { label: t('run.duration'), value: running ? t('history.so_far', { d: duration(secs) }) : duration(secs),
      sub: running ? t('run.since', { time: clock(started, tz) }) : t('run.from_to', { from: clock(started, tz), to: clock(end, tz) }) },
    { label: t('run.copied'), value: run.files != null ? t('run.files', { count: run.files, n: number(run.files) }) : '—', sub: run.bytes != null ? bytes(run.bytes) : '' },
    { label: t('run.deleted'), value: run.deleted != null ? t('run.files', { count: run.deleted, n: number(run.deleted) }) : '—',
      sub: item ? t(item.delete ? 'run.mirror_on' : 'run.mirror_off') : '' },
  ]

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link to="/history" className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-accent-ink no-underline">
          <ArrowLeft aria-hidden className="size-[18px]" />{t('nav.history')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">{item?.name ?? run.item_id}</h1>
          <StatusPill status={run.status} />
        </div>
        <span className="text-faint">
          {fullDate(started, tz)} · {t(`trigger.${run.trigger}`)}{item && ` · ${typeName(item.type)}`}
        </span>
      </div>

      {running && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-panel px-6 py-4">
          {live && (
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
              <span className="text-soft">
                <strong className="font-heading text-lg tabular-nums">{Math.floor(live.percent)}%</strong>{' · '}
                {t('run.progress', { done: bytes(live.bytes_done), total: bytes(live.bytes_total) })}
              </span>
              <div role="progressbar" aria-label={t('run.progress_label')} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.floor(live.percent)} className="h-2 overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${live.percent}%` }} />
              </div>
            </div>
          )}
          <CancelButton runId={run.id} />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
        {tiles.map((k) => (
          <div key={k.label} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-panel px-[18px] py-4">
            <span className="text-[13px] text-faint">{k.label}</span>
            <span className={cn('font-heading text-[22px] font-semibold tracking-[-0.01em]', k.color)}>{k.value}</span>
            <span className="min-h-[19px] text-[13px] text-faint">{k.sub}</span>
          </div>
        ))}
      </div>

      {(run.status === 'warning' || run.status === 'failure') && run.message && (
        <section aria-labelledby="run-why" className={cn('flex flex-col gap-2.5 rounded-2xl border px-6 py-5',
          run.status === 'warning' ? 'border-warn/40 bg-warn-bg text-warn' : 'border-fail/40 bg-fail-bg text-fail')}>
          <strong id="run-why" className="text-base">{t(run.status === 'warning' ? 'run.why_warning' : 'run.why_failure')}</strong>
          <span>{msg(run.message)}</span>
        </section>
      )}

      <Steps run={run} typeName={typeName} />
      <Log log={log} tz={tz} />
    </>
  )
}

function CancelButton({ runId }: { runId: string }) {
  const { t } = useTranslation()
  const cancel = useCancelRun()
  return (
    <HoldConfirm label={t('dashboard.cancel')} completeLabel={t('dashboard.cancelled')} icon={Square}
      onConfirm={() => cancel.mutate(runId)} className="bg-fail-bg px-[18px] text-fail hover:bg-fail-bg" />
  )
}

function Steps({ run, typeName }: { run: Run; typeName: (id: string) => string }) {
  const { t } = useTranslation()
  const skipped = run.steps.filter((s) => s.skipped).length
  return (
    <section aria-labelledby="run-steps" className="flex flex-col gap-1 rounded-2xl border border-line bg-panel px-6 pt-6 pb-3">
      <h2 id="run-steps" className="m-0 mb-2 font-heading text-lg font-semibold">{t('run.what_ran')}</h2>
      {run.steps.length === 0 ? (
        <p className="m-0 mb-3 text-faint">{t('run.no_steps')}</p>
      ) : (
        <>
          <span className="mb-1 text-[13px] text-faint">{t('run.steps_line', { count: run.steps.length, skipped })}</span>
          <ol aria-label={t('run.steps_label')} className="m-0 flex list-none flex-col p-0">
            {run.steps.map((s) => <Step key={s.n} s={s} run={run} origin={s.origin === 'core' ? t('run.core') : typeName(s.origin)} />)}
          </ol>
        </>
      )}
    </section>
  )
}

function exitPill(s: StepResult, run: Run): [string, string] {
  if (s.skipped) return ['run.skipped', 'bg-panel2 text-faint']
  if (s.exit_code == null) return [run.status === 'running' ? 'run.waiting' : 'run.not_run', 'bg-panel2 text-faint']
  if (s.exit_code === 0) return ['run.exit', 'bg-ok-bg text-ok']
  if (s.exit_code === 23 || s.exit_code === 24) return ['run.exit_warning', 'bg-warn-bg text-warn']
  return ['run.exit', 'bg-fail-bg text-fail']
}

function Step({ s, run, origin }: { s: StepResult; run: Run; origin: string }) {
  const { t } = useTranslation()
  const [key, pill] = exitPill(s, run)
  const [open, setOpen] = useState(s.exit_code != null && s.exit_code !== 0)
  const panel = `run-step-${s.n}`
  return (
    <li className="border-t border-line first:border-t-0">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center gap-3.5 rounded-xl border-0 bg-transparent px-0 py-3 text-left text-foreground">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-panel2 text-[13px] font-semibold text-soft">{s.n}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{msg(s.title)}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-semibold', pill)}>
              {t(key, { code: s.exit_code })}
            </span>
            <span className={cn('inline-flex h-[22px] items-center rounded-full border px-2 text-xs font-semibold',
              s.origin === 'core' ? 'border-line bg-panel2 text-soft' : 'border-accent bg-accent text-accent-foreground')}>{origin}</span>
            {s.duration_s != null && (
              <span className="text-[13px] text-faint tabular-nums">
                {s.duration_s < 60 ? t('dur.s', { n: number(Math.round(s.duration_s * 10) / 10) }) : duration(s.duration_s)}
              </span>
            )}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-soft transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <div id={panel} hidden={!open} className="flex flex-col gap-2 pb-3.5">
        {s.argv.length > 0 && <div className={cn(MONO, 'whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]')}>{s.argv.join(' ')}</div>}
        {s.output.length > 0 && (
          <div className={cn(MONO, 'flex flex-col gap-0.5')}>
            {s.output.map((o, i) => <span key={i} className={cn('[overflow-wrap:anywhere]', isWarnLine(o) ? 'text-warn' : 'text-faint')}>{o}</span>)}
          </div>
        )}
        {!s.argv.length && !s.output.length && s.why && <span className="text-faint">{msg(s.why)}</span>}
      </div>
    </li>
  )
}

function Log({ log, tz }: { log: LogLine[]; tz: string }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<keyof typeof FILTERS>('all')
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const lines = log.filter((l) => FILTERS[filter](l) && (!needle || l.msg.toLowerCase().includes(needle)))
  return (
    <section aria-labelledby="run-log" className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="run-log" className="m-0 font-heading text-lg font-semibold">{t('run.log')}</h2>
        <span className="text-[13px] text-faint">{t('run.log_note')}</span>
      </div>
      {log.length === 0 ? <p className="m-0 text-faint">{t('run.no_log')}</p> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label={t('run.log_filter')} value={filter} onChange={setFilter}
              options={(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((f) => ({
                value: f, label: `${t(`run.f_${f}`)} ${log.filter(FILTERS[f]).length}`,
              }))} />
            <label className="flex min-h-11 min-w-0 flex-[1_1_200px] items-center gap-2 rounded-[10px] border border-field-line bg-field px-3">
              <Search aria-hidden className="size-[18px] shrink-0 text-faint" />
              <span className="sr-only">{t('run.search')}</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('run.search')}
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-0" />
            </label>
          </div>
          <div role="region" aria-label={t('run.log_lines')} tabIndex={0}
            className="max-h-[420px] overflow-auto rounded-xl border border-line bg-background py-2.5">
            {lines.length === 0 && <p className="m-0 px-3.5 text-faint">{t('run.no_match')}</p>}
            {lines.map((l, i) => (
              <div key={i} className="flex gap-3 px-3.5 py-px font-mono text-[12.5px] leading-[1.6]">
                <span className="shrink-0 text-faint">{clock(new Date(l.t), tz)}</span>
                <span className={cn('w-11 shrink-0 font-semibold', LEVEL[l.level])}>{l.level}</span>
                <span className="min-w-0 flex-auto text-foreground [overflow-wrap:anywhere]">{l.msg}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
