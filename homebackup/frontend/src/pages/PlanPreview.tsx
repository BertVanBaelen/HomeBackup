import { ArrowLeft, ChevronDown, Info, Play, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import {
  type Result, type Status, type Step,
  useDryRun, useItem, useItems, usePlan, useRunNow, useSettings, useStatus, useTypes,
} from '@/api/client'
import { HoldConfirm } from '@/components/hb/HoldConfirm'
import { StatusPill } from '@/components/hb/Status'
import i18n from '@/i18n'
import { dayLabel } from '@/lib/format'
import { msg } from '@/lib/messages'
import { cn } from '@/lib/utils'

const card = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-panel p-6'
const h2 = 'm-0 font-heading text-lg font-semibold'
const chip = 'rounded-full border border-line bg-panel2 px-2.5 py-1 text-soft [overflow-wrap:anywhere]'
const badge = 'inline-flex h-[22px] shrink-0 items-center rounded-full border px-2 text-xs font-semibold'
const CORE = 'border-line2 bg-panel2 text-soft'
const TYPE = 'border-accent bg-accent text-accent-foreground'

/** "1 to 3 and 10": runs of three or more consecutive numbers become a range. */
function stepList(ns: number[]) {
  const parts: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (ns[j + 1] === ns[j] + 1) j++
    if (j - i >= 2) { parts.push(i18n.t('plan.range', { from: ns[i], to: ns[j] })); i = j }
    else parts.push(String(ns[i]))
  }
  return new Intl.ListFormat(i18n.language === 'nl' ? 'nl' : 'en-GB', { type: 'conjunction' }).format(parts)
}

/** Flags of every rsync step in order; an unknown bundle like -rRt is split into its letters. */
function rsyncFlags(steps: Step[]) {
  const known = (f: string) => i18n.exists(`plan.flags.${f}`)
  const out = new Set<string>()
  for (const s of steps.filter((s) => s.argv[0] === 'rsync')) {
    for (const a of s.argv.slice(1).filter((a) => a.startsWith('-'))) {
      if (known(a)) out.add(a)
      else if (/^-[a-zA-Z]{2,}$/.test(a)) for (const c of a.slice(1)) out.add(`-${c}`)
      else out.add(a.split('=')[0])
    }
  }
  return [...out]
}

export function PlanPreview() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const plan = usePlan(id).data
  const item = useItem(id).data
  const status = useStatus().data
  const settings = useSettings().data
  const view = useItems().data?.find((i) => i.id === id)
  const types = useTypes().data
  const dryRun = useDryRun()
  const runNow = useRunNow()
  // Phone shows only the copy step open; wider screens open them all. Selecting a step flips it.
  const [wide] = useState(() => window.matchMedia('(min-width: 600px)').matches)
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  if (!plan || !item) return <p className="text-faint">{t('common.loading')}</p>

  const typeName = (tid: string) => types?.find((x) => x.id === tid)?.name ?? tid
  const go = (s: Status) => {
    const run = s.running.find((p) => p.run_id.startsWith(`${id}-`))
    navigate(run ? `/runs/${run.run_id}` : '/')
  }
  const blocked = !!plan.error
  const next = view?.next_run && status
    ? dayLabel(new Date(view.next_run), new Date(status.now), status.time_zone) : t('plan.not_scheduled')
  const steps = plan.steps
  const commands = steps.filter((s) => s.argv.length > 0).length
  const coreSteps = steps.filter((s) => s.origin === 'core').map((s) => s.n)
  const typeSteps = steps.filter((s) => s.origin !== 'core').map((s) => s.n)
  const flags = rsyncFlags(steps)
  const flagRows = flags.map((f) => [f, i18n.exists(`plan.flags.${f}`) ? t(`plan.flags.${f}`) : ''])
  if (flags.length > 0 && !flags.includes('--delete')) flagRows.push(['--delete', t('plan.no_delete')])
  const deviceStep = steps.find((s) => s.argv.some((a) => a.includes('{device}')))?.n
  const hook = (r: Exclude<Result, 'running'>) => {
    const key = ({ success: 'on_success', warning: 'on_warning', failure: 'on_failure' } as const)[r]
    // Item hook: null = the Settings default, "" = none.
    const h = item.hooks?.[key] ?? settings?.[`hook_${r}`]
    return h ? t('plan.calls', { hook: h }) : t('plan.calls_none')
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <Link to={`/items/${id}`} className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-accent-ink no-underline">
            <ArrowLeft aria-hidden className="size-[18px]" />{item.name}
          </Link>
          <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">{t('plan.title')}</h1>
          <span className="text-faint">{t('plan.subline', { type: typeName(item.type), when: next })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={blocked || dryRun.isPending}
            onClick={() => dryRun.mutate(id, { onSuccess: go })}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line2 bg-transparent px-[18px] font-semibold text-foreground disabled:cursor-default disabled:opacity-50">
            {t('plan.dry_run')}
          </button>
          <HoldConfirm label={t('plan.run_now')} completeLabel={t('plan.started')} icon={Play} variant="green"
            disabled={blocked} onConfirm={() => runNow.mutate(id, { onSuccess: go })}
            className="border-0 bg-brand px-5 text-white hover:bg-brand/90 dark:bg-brand dark:text-white" />
        </div>
      </div>

      {plan.error ? (
        <div role="alert" className="flex items-start gap-3 rounded-[14px] border border-alert-line bg-alert-bg px-4 py-3.5 text-alert-text">
          <TriangleAlert aria-hidden className="mt-px size-5 shrink-0 text-fail" />
          <span className="font-semibold text-alert-head">{msg(plan.error)}</span>
        </div>
      ) : (
        <>
          <div role="status" className="flex items-start gap-3 rounded-[14px] bg-accent px-4 py-3.5 text-accent-foreground">
            <Info aria-hidden className="mt-px size-5 shrink-0" />
            <span><strong>{t('plan.preview_strong')}</strong> {t('plan.preview_text')}</span>
          </div>

          <div className="flex flex-wrap items-stretch gap-4">
            <Section title={t('plan.how_title')}>
              <span className="text-soft">{t('plan.how_text')}</span>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0 font-mono text-[12.5px]">
                {plan.programs.map((p) => <li key={p} className={chip}>{p}</li>)}
              </ul>
              <span className="text-soft">{t('plan.how_source')}</span>
            </Section>
            <Section title={t('plan.origin_title')}>
              <span className="text-soft">{t('plan.origin_text', { type: typeName(item.type) })}</span>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {[{ label: t('plan.core'), cls: CORE, ns: coreSteps }, { label: typeName(item.type), cls: TYPE, ns: typeSteps }]
                  .filter((o) => o.ns.length > 0).map((o) => (
                    <li key={o.cls} className="flex items-start gap-2.5">
                      <span className={cn(badge, o.cls)}>{o.label}</span>
                      <span className="text-soft">{t('plan.origin_steps', { count: o.ns.length, list: stepList(o.ns) })}</span>
                    </li>
                  ))}
              </ul>
              <span className="text-[13px] text-faint">{t('plan.type_files')}</span>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0 font-mono text-[12.5px]">
                <li className={chip}>types/{item.type}/type.json</li>
                <li className={chip}>types/{item.type}/plan.py</li>
              </ul>
            </Section>
            <Section title={t('plan.flags_title')}>
              {flags.length === 0 ? <span className="text-soft">{t('plan.flags_none')}</span> : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {flagRows.map(([f, text]) => (
                    <li key={f} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <code className="rounded-md border border-line bg-panel2 px-2 py-0.5 font-mono text-[12.5px] text-foreground">{f}</code>
                      {text && <span className="text-soft">{text}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="-mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={h2}>{t('plan.steps_title')}</h2>
            <span className="text-[13px] text-faint">
              {t('plan.steps_line', {
                steps: t('plan.n_steps', { count: steps.length }), commands: t('plan.n_commands', { count: commands }),
              })}
            </span>
          </div>
          <ol aria-label={t('plan.steps_title')} className="m-0 flex list-none flex-col gap-3 p-0">
            {steps.map((s) => {
              const open = (wide || s.argv[0] === 'rsync') !== flipped.has(s.n)
              const toggle = () => setFlipped((f) => {
                const n = new Set(f)
                if (!n.delete(s.n)) n.add(s.n)
                return n
              })
              return (
                <li key={s.n} className={cn('rounded-2xl border bg-panel', s.skipped ? 'border-dashed border-line2' : 'border-line')}>
                  <button type="button" aria-expanded={open} aria-controls={`step-${s.n}`} onClick={toggle}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3.5 rounded-2xl bg-transparent px-5 py-4 text-left text-foreground">
                    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full font-bold',
                      s.skipped ? 'bg-panel2 text-faint' : 'bg-accent text-accent-foreground')}>{s.n}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-semibold">{msg(s.title)}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn(badge, s.origin === 'core' ? CORE : TYPE)}>
                          {s.origin === 'core' ? t('plan.core') : typeName(s.origin)}
                        </span>
                        <span className="text-[13px] text-faint">
                          {s.skipped || s.argv.length === 0 ? t('plan.skipped') : `${t('plan.n_commands', { count: 1 })} · ${s.argv[0]}`}
                        </span>
                      </span>
                    </span>
                    <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-soft transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                  </button>
                  <div id={`step-${s.n}`} hidden={!open} className="flex flex-wrap gap-x-4 gap-y-3 px-5 pb-5">
                    <span className="min-w-0 flex-[1_1_220px] text-soft">{msg(s.why)}</span>
                    {s.argv.length > 0 && (
                      <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-2">
                        <code className="block rounded-[10px] border border-line bg-background px-3 py-2.5 font-mono text-[12.5px] leading-[1.55] whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                          {s.argv.join(' ')}
                        </code>
                        {s.n === deviceStep && <span className="text-[13px] text-faint">{t('plan.device_note')}</span>}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <section aria-labelledby="pp-result-h" className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
            <h2 id="pp-result-h" className={h2}>{t('plan.result_title')}</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {(['success', 'warning', 'failure'] as const).map((r) => (
                <li key={r} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-[92px]"><StatusPill status={r} /></span>
                  <span className="min-w-0 flex-[1_1_240px] text-soft">{t(`plan.result_${r}`)}</span>
                  <span className="shrink-0 text-[13px] text-faint">{hook(r)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn(card, 'flex-[1_1_300px]')}>
      <h2 className={h2}>{title}</h2>
      {children}
    </section>
  )
}
