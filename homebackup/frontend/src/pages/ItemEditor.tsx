import { ArrowLeft, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import {
  type BackupType, type Item, type Result, type Settings, type TargetView,
  fieldErrors, useDeleteItem, useDryRun, useItem, useItemCheck, useSaveItem, useScripts, useSettings, useStatus,
  useTargets, useTypes,
} from '@/api/client'
import { HoldConfirm } from '@/components/hb/HoldConfirm'
import { StatusIcon } from '@/components/hb/Status'
import i18n from '@/i18n'
import { clock, scheduleText } from '@/lib/format'
import { msg } from '@/lib/messages'
import { cn } from '@/lib/utils'

const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[18px] font-semibold no-underline'
const section = 'flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6'
const h2 = 'm-0 font-heading text-lg font-semibold'
const input = 'min-h-11 w-full rounded-[10px] border border-field-line bg-field px-3 text-foreground'
const select = 'min-h-11 w-full rounded-[10px] border border-field-line bg-field px-2.5 text-foreground'
const mono = 'font-mono text-[13.5px]'
const hint = 'text-[13px] text-faint'
const cardGrid = 'grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3'
const LEVEL: Record<string, Result> = { ok: 'success', warning: 'warning', error: 'failure' }
const FS: Record<string, string> = { exfat: 'exFAT', ntfs: 'NTFS', vfat: 'FAT32' }
const HOOKS = [['on_success', 'hook_success'], ['on_warning', 'hook_warning'], ['on_failure', 'hook_failure']] as const
const DEFAULT = '*' // select value for "use the default from Settings" (null in the API)

export function ItemEditor() {
  const { t } = useTranslation()
  const { id } = useParams()
  const item = useItem(id).data
  const types = useTypes().data
  const targets = useTargets().data
  const settings = useSettings().data
  const scripts = useScripts().data
  if ((id && !item) || !types || !targets || !settings || !scripts) return <p className="text-faint">{t('common.loading')}</p>
  const initial: Item = item ?? {
    id: '', name: '', enabled: true, type: 'rsync', source: '', target_id: targets[0]?.id ?? '', target_path: '',
    include_thumbs: false, delete: false, schedule: '0 3 * * *', hooks: { on_success: null, on_warning: null, on_failure: null },
  }
  return <Editor key={id ?? 'new'} initial={initial} types={types} targets={targets} settings={settings} scripts={scripts} />
}

function Editor({ initial, types, targets, settings, scripts }: {
  initial: Item; types: BackupType[]
  targets: TargetView[]; settings: Settings; scripts: string[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<Item>) => setForm((f) => ({ ...f, ...patch }))
  const [checked, setChecked] = useState(initial)
  useEffect(() => {
    const h = setTimeout(() => setChecked(form), 400)
    return () => clearTimeout(h)
  }, [form])
  const check = useItemCheck(checked).data
  const tz = useStatus().data?.time_zone ?? settings.time_zone
  const save = useSaveItem()
  const del = useDeleteItem()
  const dry = useDryRun()
  const errors = fieldErrors(save.error)
  const saved = !!initial.id
  const type = types.find((x) => x.id === form.type)
  const target = targets.find((x) => x.id === form.target_id)
  const overlap = check?.checks.find((c) => c.message.code === 'overlap')
  let when: string | null = null
  try { when = scheduleText(form.schedule) } catch { /* invalid cron: the check lists it */ }

  const describe = (name: string) => ({
    id: `ed-${name}`, 'aria-invalid': !!errors[name] || undefined, 'aria-describedby': `ed-${name}-hint ed-${name}-err`,
  })
  const targetLabel = (x: TargetView) => `${x.name} · ${x.kind === 'share'
    ? t('editor.share', { proto: (x.protocol ?? '').toUpperCase() })
    : t('editor.drive', { fs: FS[x.filesystem ?? ''] ?? x.filesystem ?? '' })}`
  const runDay = (iso: string) => {
    const d = new Date(iso)
    const day = new Intl.DateTimeFormat(i18n.language === 'nl' ? 'nl-BE' : 'en-GB', {
      timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }).format(d).replace(/[.,]/g, '')
    return `${day} · ${clock(d, tz)}`
  }
  const pickType = (id: string) => set(id === 'immich'
    ? { type: id, immich_mode: form.immich_mode ?? 'recent', window: form.window ?? 2, window_unit: form.window_unit ?? 'months' }
    : { type: id })
  const startDry = () => dry.mutate(form.id, {
    onSuccess: (s) => {
      const run = s.running.find((r) => r.run_id.startsWith(`${form.id}-`))
      navigate(run ? `/runs/${run.run_id}` : '/')
    },
  })

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-accent-ink no-underline">
          <ArrowLeft aria-hidden className="size-[18px]" />{t('nav.dashboard')}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">
            {initial.name || t('editor.new')}
          </h1>
          <span className="text-faint">{saved ? `${t('editor.edit')} · ${type?.name ?? form.type}` : type?.name}</span>
        </div>
      </div>

      {overlap && (
        <div role="status" className="flex items-start gap-3 rounded-[14px] border border-warn-ic/40 bg-warn-bg px-4 py-3.5 text-warn">
          <StatusIcon status="warning" className="mt-px text-warn" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong>{t('editor.overlap_title', { item: overlap.message.params?.item })}</strong>
            <span>{t('editor.overlap_body', { dest: `${target?.name ?? '?'}/${form.target_path}` })}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <section aria-labelledby="ed-basics" className={section}>
            <h2 id="ed-basics" className={h2}>{t('editor.basics')}</h2>
            <Field id="ed-name" label={t('editor.name')} hint={t('editor.name_hint')} error={errors.name}>
              <input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} className={input} {...describe('name')} />
            </Field>
            <div className="flex min-h-11 items-center justify-between gap-4">
              <span id="ed-enabled" className="font-semibold">{t('editor.enabled')}</span>
              <Switch on={form.enabled} labelledBy="ed-enabled" onClick={() => set({ enabled: !form.enabled })} />
            </div>
            <div role="group" aria-label={t('editor.type')} className={cardGrid}>
              {types.map((ty) => (
                <Card key={ty.id} on={ty.id === form.type} disabled={!!ty.error} onClick={() => pickType(ty.id)}
                  title={ty.name} desc={ty.error ?? t(`editor.type_desc.${ty.id}`, { defaultValue: '' })} />
              ))}
            </div>
            {type && !type.builtin && (
              <span className={hint}>
                <Trans i18nKey="editor.type_note" values={{ path: `types/${type.id}/` }}
                  components={{ code: <span className="font-mono text-[12.5px] [overflow-wrap:anywhere] text-soft" /> }} />
              </span>
            )}
          </section>

          <section aria-labelledby="ed-copy" className={section}>
            <h2 id="ed-copy" className={h2}>{t('editor.copy')}</h2>
            <Field id="ed-source" label={t('editor.source')} hint={t('editor.source_hint')} error={errors.source}>
              <input type="text" value={form.source} onChange={(e) => set({ source: e.target.value })} className={cn(input, mono)} {...describe('source')} />
            </Field>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
              <Field id="ed-target_id" label={t('editor.target')} error={errors.target_id}>
                <select value={form.target_id} onChange={(e) => set({ target_id: e.target.value })} className={select} {...describe('target_id')}>
                  {targets.map((x) => <option key={x.id} value={x.id}>{targetLabel(x)}</option>)}
                </select>
              </Field>
              <Field id="ed-target_path" label={t('editor.target_path')} error={errors.target_path}>
                <input type="text" value={form.target_path} onChange={(e) => set({ target_path: e.target.value })} className={cn(input, mono)} {...describe('target_path')} />
              </Field>
            </div>
            {form.type === 'immich' && (
              <>
                <div className="flex flex-col gap-2">
                  <span id="ed-mode" className="font-semibold">{t('editor.immich_mode')}</span>
                  <div role="group" aria-labelledby="ed-mode" className={cardGrid}>
                    {(['recent', 'full'] as const).map((m) => (
                      <Card key={m} on={form.immich_mode === m} onClick={() => set({ immich_mode: m })}
                        title={t(`editor.mode.${m}`)} desc={t(`editor.mode.${m}_desc`)} />
                    ))}
                  </div>
                  <span className={hint}>{t('editor.mode_hint')}</span>
                </div>
                {form.immich_mode !== 'full' && (
                  <div className="flex flex-wrap items-end gap-3">
                    <Field id="ed-window" label={t('editor.window')} error={errors.window}>
                      <input type="number" min={1} value={form.window ?? ''} className={cn(input, 'w-22')} {...describe('window')}
                        onChange={(e) => set({ window: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <label className="flex flex-col gap-1.5">
                      <span className="sr-only">{t('editor.window_unit')}</span>
                      <select value={form.window_unit ?? 'months'} className={select}
                        onChange={(e) => set({ window_unit: e.target.value as Item['window_unit'] })}>
                        <option value="months">{t('editor.unit.months')}</option>
                        <option value="days">{t('editor.unit.days')}</option>
                      </select>
                    </label>
                    <span className="inline-flex min-h-11 items-center text-faint">{t('editor.back_from_today')}</span>
                  </div>
                )}
                <label className="flex min-h-11 items-start gap-3">
                  <input type="checkbox" checked={form.include_thumbs} onChange={(e) => set({ include_thumbs: e.target.checked })}
                    className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{t('editor.thumbs')}</span>
                    <span className={hint}>{t('editor.thumbs_hint')}</span>
                  </span>
                </label>
              </>
            )}
          </section>

          <section aria-labelledby="ed-cleanup" className={cn(section, 'gap-3', form.delete && 'border-2 border-warn-ic')}>
            <h2 id="ed-cleanup" className={h2}>{t('editor.cleanup')}</h2>
            <div className="flex min-h-11 items-center justify-between gap-4">
              <span id="ed-delete" className="font-semibold">{t('editor.delete_label')}</span>
              {form.delete
                ? <Switch on labelledBy="ed-delete" warn onClick={() => set({ delete: false })} />
                : <HoldConfirm variant="orange" icon={Trash2} label={t('editor.turn_on')} completeLabel={t('editor.turned_on')}
                    aria-describedby="ed-delete" className="shrink-0 px-4" onConfirm={() => set({ delete: true })} />}
            </div>
            <span className={hint}>{t('editor.delete_hint')}</span>
            <span className={cn('inline-flex h-[26px] items-center self-start rounded-full px-2.5 text-[12.5px] font-semibold',
              form.delete ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok')}>
              {t(form.delete ? 'editor.mirror' : 'editor.safe')}
            </span>
          </section>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="ed-schedule-h" className={section}>
            <h2 id="ed-schedule-h" className={h2}>{t('editor.schedule')}</h2>
            <div className="flex flex-col gap-1.5">
              <Field id="ed-schedule" label={t('editor.cron')} error={errors.schedule}>
                <input type="text" value={form.schedule} onChange={(e) => set({ schedule: e.target.value })} className={cn(input, mono)} {...describe('schedule')} />
              </Field>
              <span className="text-soft">{when ? `${when} · ${tz}` : t('msg.cron_invalid')}</span>
              <span className={hint}>{t('editor.tz_note')}</span>
            </div>
            {check?.schedule_valid && check.next_runs.length > 0 && (
              <div className="flex flex-col gap-2">
                <span id="ed-next" className="font-semibold">{t('editor.next_runs')}</span>
                <ol aria-labelledby="ed-next" className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {check.next_runs.map((r) => (
                    <li key={r} className="flex items-center gap-2.5 text-soft tabular-nums">
                      <span aria-hidden className="size-1.5 rounded-full bg-accent-ink" />{runDay(r)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section aria-labelledby="ed-hooks" className={section}>
            <div className="flex flex-col gap-2">
              <h2 id="ed-hooks" className={h2}>{t('editor.hooks')}</h2>
              <span className={hint}>{t('editor.hooks_hint')}</span>
            </div>
            {HOOKS.map(([key, setting]) => {
              const v = form.hooks[key]
              return (
                <Field key={key} id={`ed-${key}`} label={t(`editor.${key}`)} error={errors[key]}>
                  <select id={`ed-${key}`} value={v ?? DEFAULT} className={select}
                    onChange={(e) => set({ hooks: { ...form.hooks, [key]: e.target.value === DEFAULT ? null : e.target.value } })}>
                    <option value={DEFAULT}>{t('editor.default', { script: settings[setting] || t('editor.none') })}</option>
                    <option value="">{t('editor.none')}</option>
                    {[...new Set([...scripts, ...(v ? [v] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              )
            })}
          </section>

          <section aria-labelledby="ed-check" className={section}>
            <h2 id="ed-check" className={h2}>{t('editor.check')}</h2>
            {check && (
              <>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {check.checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <StatusIcon status={LEVEL[c.level]} size={18} className="mt-0.5" />
                      <span className="text-soft"><span className="sr-only">{t(`editor.level.${c.level}`)}: </span>{msg(c.message)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2">
                  <span id="ed-folders" className="font-semibold">{t('editor.folders')}</span>
                  <ul aria-labelledby="ed-folders" className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-[12.5px]">
                    {check.folders.map((f) => (
                      <li key={f.path} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-panel2 px-2.5 py-1.5 text-soft">
                        <span className="[overflow-wrap:anywhere]">{f.path}</span>
                        <span className="font-sans text-xs text-faint">{t(`editor.tag.${f.tag}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <span className={hint}>{t('editor.folders_note')}</span>
                </div>
              </>
            )}
            {saved && (
              <div className="flex flex-wrap gap-2">
                <Link to={`/items/${form.id}/plan`} className={cn(pill, 'border border-line2 text-foreground')}>{t('editor.preview')}</Link>
                <button type="button" disabled={dry.isPending} onClick={startDry}
                  className={cn(pill, 'border border-line2 bg-transparent text-foreground disabled:opacity-50')}>
                  {t('editor.dry_run')}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-[clamp(16px,4vw,32px)] border-t border-line bg-background px-[clamp(16px,4vw,32px)] py-3">
        {save.error && !Object.keys(errors).length && (
          <p role="alert" className="mt-0 mb-2 text-fail">{t('editor.save_failed', { error: save.error.message })}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {saved ? (
            <HoldConfirm icon={Trash2} label={t('editor.delete')} completeLabel={t('editor.deleted')}
              onConfirm={() => del.mutate(form.id, { onSuccess: () => navigate('/') })}
              className="border-alert-btn bg-transparent px-4 text-fail hover:bg-fail-bg" />
          ) : <span />}
          <div className="flex gap-2">
            <Link to="/" className={cn(pill, 'text-soft')}>{t('editor.cancel')}</Link>
            <button type="button" disabled={save.isPending} onClick={() => save.mutate(form, { onSuccess: () => navigate('/') })}
              className={cn(pill, 'border-0 bg-brand px-6 text-white disabled:opacity-50')}>
              {t('editor.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ id, label, hint: h, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">{label}</label>
      {children}
      {h && <span id={`${id}-hint`} className={hint}>{h}</span>}
      {error && <span id={`${id}-err`} className="text-[13px] text-fail">{error}</span>}
    </div>
  )
}

function Switch({ on, warn, labelledBy, onClick }: { on: boolean; warn?: boolean; labelledBy: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-labelledby={labelledBy} onClick={onClick}
      className="inline-flex h-11 w-14 shrink-0 items-center justify-center border-0 bg-transparent p-0">
      <span className={cn('flex h-8 w-[52px] items-center rounded-full p-[3px]',
        on ? 'justify-end' : 'justify-start', on ? (warn ? 'bg-[#b45309]' : 'bg-brand') : 'bg-field-line')}>
        <span className="size-[26px] rounded-full bg-white" />
      </span>
    </button>
  )
}

function Card({ on, disabled, title, desc, onClick }: { on: boolean; disabled?: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={cn('flex min-h-11 flex-col gap-1 rounded-xl border-2 px-3.5 py-3 text-left text-foreground disabled:opacity-60',
        on ? 'border-accent-ink bg-accent' : 'border-line bg-panel')}>
      <span className="font-semibold">{title}</span>
      {desc && <span className="text-[13px] text-faint">{desc}</span>}
    </button>
  )
}
