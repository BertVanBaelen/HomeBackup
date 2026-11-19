import { Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import {
  type TargetIn, type TargetTest, type TargetView,
  fieldErrors, useDeleteTarget, useDevices, useItems, useSaveTarget, useTargets, useTestTarget,
} from '@/api/client'
import { HoldConfirm } from '@/components/hb/HoldConfirm'
import { StatusIcon } from '@/components/hb/Status'
import { bytes } from '@/lib/format'
import { msg } from '@/lib/messages'
import { cn } from '@/lib/utils'

const FS: Record<string, string> = { exfat: 'exFAT', ext4: 'ext4', ntfs: 'NTFS', vfat: 'FAT32', auto: 'auto' }
const SAFE = '-rt --no-perms --no-owner --no-group'
/** rsync flags that suit each filesystem or protocol; 'auto' has none, so the flags stay as they are. */
const PRESET: Record<string, string> = {
  exfat: `${SAFE} --modify-window=2`, vfat: `${SAFE} --modify-window=2`, ntfs: `${SAFE} --modify-window=2`,
  ext4: '-a', smb: SAFE, nfs: '-a',
}
const UNITS = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }
type Unit = keyof typeof UNITS

const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[18px] font-semibold no-underline'
const input = 'min-h-11 w-full rounded-[10px] border border-field-line bg-field px-3 text-foreground'
const mono = 'font-mono text-[13.5px]'

const presetKey = (f: TargetIn) => (f.kind === 'drive' ? f.filesystem : f.protocol) ?? ''

export function Targets() {
  const { t } = useTranslation()
  const { id } = useParams()
  const targets = useTargets().data
  const items = useItems().data ?? []
  if (!targets) return <p className="text-faint">{t('common.loading')}</p>
  const names = Object.fromEntries(items.map((i) => [i.id, i.name]))
  const editing = id === 'new' ? null : targets.find((x) => x.id === id)
  const open = id === 'new' || !!editing

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">{t('targets.title')}</h1>
          <span className="text-faint">{t('targets.subline')}</span>
        </div>
        <Link to="/targets/new" className={`${pill} bg-brand text-white`}>
          <Plus aria-hidden className="size-4" />
          {t('targets.new')}
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ul aria-label={t('targets.list')}
          className={cn('m-0 grid min-w-0 list-none gap-4 p-0', open ? 'lg:flex-[1_1_300px]' : 'min-[600px]:grid-cols-2 lg:flex-1 lg:grid-cols-3')}>
          {targets.map((x) => <Card key={x.id} x={x} current={x.id === id} used={x.used_by.map((u) => names[u] ?? u)} />)}
        </ul>
        {open && <Editor key={id} target={editing ?? undefined} />}
      </div>
    </>
  )
}

function Card({ x, current, used }: { x: TargetView; current: boolean; used: string[] }) {
  const { t } = useTranslation()
  const s = x.status
  const kind = x.kind === 'drive'
    ? t('targets.kind_drive', { fs: FS[x.filesystem ?? ''] ?? x.filesystem })
    : t('targets.kind_share', { proto: (x.protocol ?? '').toUpperCase() })
  const ident = x.kind === 'share'
    ? (x.protocol === 'nfs' ? `${x.host}:${x.share}` : `//${x.host}/${x.share}`)
    : t(x.find_by === 'label' ? 'targets.ident_label' : 'targets.ident_uuid', { v: x.ident })
  const line = s.ok
    ? [t(x.kind === 'drive' ? 'targets.plugged_in' : 'targets.reachable'), s.device,
        s.free_bytes != null && t('targets.free', { size: bytes(s.free_bytes) })].filter(Boolean).join(' · ')
    : msg(s.problem)

  return (
    <li>
      <article aria-current={current}
        className={cn('flex flex-col gap-2.5 rounded-2xl p-5', current ? 'border-2 border-accent-ink bg-accent' : 'border border-line bg-panel')}>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="m-0 text-base font-semibold [overflow-wrap:anywhere]">{x.name}</h2>
            <span className="text-faint">{kind}</span>
          </div>
          {current
            ? <span className="shrink-0 text-[13px] font-semibold text-accent-ink">{t('targets.editing')}</span>
            : <Link to={`/targets/${x.id}`} aria-label={t('targets.edit_name', { name: x.name })}
                className={`${pill} shrink-0 border border-line2 text-foreground`}>{t('targets.edit')}</Link>}
        </div>
        <span className="font-mono text-[12.5px] text-soft [overflow-wrap:anywhere]">{ident}</span>
        <span className={cn('flex items-start gap-2 font-semibold', s.ok ? 'text-ok' : 'text-fail')}>
          <StatusIcon status={s.ok ? 'success' : 'failure'} size={18} className="mt-px" />
          <span className="sr-only">{t(s.ok ? 'targets.ok' : 'targets.problem')}: </span>
          <span>{line}</span>
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[13px] text-faint">{t('targets.used_by')}</span>
          {used.length === 0 && <span className="text-[13px] text-faint">{t('targets.unused')}</span>}
          {used.map((u) => (
            <span key={u} className="inline-flex min-h-[26px] items-center rounded-full border border-line bg-panel2 px-2.5 text-[12.5px] text-soft">{u}</span>
          ))}
        </div>
      </article>
    </li>
  )
}

const BLANK: TargetIn = {
  id: '', name: '', kind: 'drive', filesystem: 'exfat', find_by: 'uuid', ident: '', protocol: null, host: null,
  share: null, username: null, mount_options: '', rsync_flags: PRESET.exfat, min_free_bytes: 10 * UNITS.GB,
}

/** Largest unit that shows the stored byte count as a whole number (MB as the fallback). */
function toUnit(b: number): [number, Unit] {
  const u = (['TB', 'GB'] as const).find((k) => b >= UNITS[k] && b % UNITS[k] === 0) ?? 'MB'
  return [Math.round(b / UNITS[u]), u]
}

function Editor({ target }: { target?: TargetView }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const devices = useDevices().data ?? []
  const save = useSaveTarget()
  const del = useDeleteTarget()
  const test = useTestTarget()
  const [f, setF] = useState<TargetIn>(() => {
    if (!target) return BLANK
    const { status: _s, used_by: _u, password_set: _p, ...rest } = target
    return rest
  })
  const [password, setPassword] = useState('')
  const [[amount, unit], setSize] = useState(() => toUnit(f.min_free_bytes))
  const errs = fieldErrors(save.error)
  const set = (patch: Partial<TargetIn>) => setF((cur) => {
    const next = { ...cur, ...patch }
    const p = PRESET[presetKey(next)]
    return p && presetKey(next) !== presetKey(cur) ? { ...next, rsync_flags: p } : next
  })
  const smb = f.kind === 'share' && f.protocol === 'smb'
  const body = (): TargetIn => ({
    ...f,
    min_free_bytes: Math.round(amount * UNITS[unit]),
    ...(f.kind === 'drive'
      ? { protocol: null, host: null, share: null, username: null }
      : { filesystem: null, find_by: null, ident: null, username: smb ? f.username : null }),
    ...(smb && password ? { password } : {}),
  })
  const key = presetKey(f)
  const isPreset = PRESET[key] === f.rsync_flags
  const presetName = f.kind === 'drive' ? FS[key] : key.toUpperCase()
  const back = () => navigate('/targets')
  const pickIdent = (v: string) => {
    const d = devices.find((x) => (f.find_by === 'label' ? x.label : x.uuid) === v)
    set({ ident: v, ...(d?.filesystem && d.filesystem in FS ? { filesystem: d.filesystem } : {}) })
  }

  return (
    <section aria-labelledby="tg-editor-h"
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-panel p-6 lg:flex-[3_1_420px]">
      <h2 id="tg-editor-h" className="m-0 font-heading text-lg font-semibold">
        {target ? t('targets.edit_title', { name: target.name }) : t('targets.new_title')}
      </h2>

      <Field label={t('targets.name')} hint={t('targets.name_hint')} error={errs.name}>
        <input type="text" className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>

      <Seg label={t('targets.type')} group={t('targets.type_group')} value={f.kind}
        options={[['drive', t('targets.drive')], ['share', t('targets.share')]]}
        onChange={(kind) => set(kind === 'drive'
          ? { kind, filesystem: f.filesystem ?? 'exfat', find_by: f.find_by ?? 'uuid', ident: f.ident ?? '' }
          : { kind, protocol: f.protocol ?? 'smb', host: f.host ?? '', share: f.share ?? '' })} />

      {f.kind === 'drive' ? (
        <>
          <Seg label={t('targets.find_by')} value={f.find_by ?? 'uuid'}
            options={[['uuid', t('targets.uuid')], ['label', t('targets.label')]]}
            onChange={(find_by) => set({ find_by })} />
          <Field label={t(f.find_by === 'label' ? 'targets.label' : 'targets.uuid')} error={errs.ident}
            hint={t(f.find_by === 'label' ? 'targets.label_hint' : 'targets.uuid_hint')}>
            <input type="text" list="tg-devices" className={cn(input, mono)} value={f.ident ?? ''}
              onChange={(e) => pickIdent(e.target.value)} />
          </Field>
          <datalist id="tg-devices">
            {devices.map((d) => {
              const v = f.find_by === 'label' ? d.label : d.uuid
              return v && <option key={d.device} value={v}>{t('targets.detected', { device: d.device, fs: FS[d.filesystem ?? ''] ?? d.filesystem ?? '' })}</option>
            })}
          </datalist>
          <Field label={t('targets.filesystem')} error={errs.filesystem}>
            <select className={input} value={f.filesystem ?? 'auto'} onChange={(e) => set({ filesystem: e.target.value })}>
              {Object.entries(FS).map(([v, n]) => <option key={v} value={v}>{v === 'auto' ? t('targets.fs_auto') : n}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
            <Field label={t('targets.protocol')}>
              <select className={input} value={f.protocol ?? 'smb'} onChange={(e) => set({ protocol: e.target.value as 'smb' | 'nfs' })}>
                <option value="smb">SMB</option>
                <option value="nfs">NFS</option>
              </select>
            </Field>
            <Field label={t('targets.host')} error={errs.host}>
              <input type="text" className={input} value={f.host ?? ''} onChange={(e) => set({ host: e.target.value })} />
            </Field>
            <Field label={t(smb ? 'targets.share_name' : 'targets.export')} error={errs.share}>
              <input type="text" className={input} value={f.share ?? ''} onChange={(e) => set({ share: e.target.value })} />
            </Field>
          </div>
          {smb && (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
                <Field label={t('targets.username')} error={errs.username}>
                  <input type="text" autoComplete="off" className={input} value={f.username ?? ''}
                    onChange={(e) => set({ username: e.target.value })} />
                </Field>
                <Field label={t('targets.password')} error={errs.password}>
                  <input type="password" autoComplete="new-password" className={input} value={password}
                    placeholder={target?.password_set ? t('targets.password_set') : undefined}
                    onChange={(e) => setPassword(e.target.value)} />
                </Field>
              </div>
              <span className="text-[13px] text-faint">{t('targets.password_hint')}</span>
            </div>
          )}
        </>
      )}

      <Field label={t('targets.mount_options')} error={errs.mount_options}>
        <input type="text" className={cn(input, mono)} value={f.mount_options} onChange={(e) => set({ mount_options: e.target.value })} />
      </Field>

      <Field error={errs.rsync_flags}
        label={<span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {t('targets.flags')}
          <span className="inline-flex h-[22px] items-center rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">
            {isPreset ? t('targets.preset', { name: presetName }) : t('targets.custom')}
          </span>
        </span>}
        hint={`${t('targets.flags_hint')} ${isPreset ? t(`targets.note_${key}`) : ''}`}>
        <input type="text" className={cn(input, 'font-mono text-[13px]')} value={f.rsync_flags}
          onChange={(e) => set({ rsync_flags: e.target.value })} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t('targets.min_free')}</span>
            <input type="number" min={0} className={cn(input, 'w-24')} value={amount}
              onChange={(e) => setSize([Number(e.target.value), unit])} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t('targets.unit')}</span>
            <select className={input} value={unit} onChange={(e) => setSize([amount, e.target.value as Unit])}>
              {(['GB', 'MB', 'TB'] as const).map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <span className="inline-flex min-h-11 items-center text-faint">{t('targets.checked')}</span>
        </div>
        {errs.min_free_bytes && <span className="text-[13px] text-fail">{errs.min_free_bytes}</span>}
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl bg-panel2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={test.isPending} onClick={() => test.mutate(body())}
            className={`${pill} border border-line2 bg-transparent text-foreground`}>{t('targets.test')}</button>
          <span className="text-faint">{t('targets.test_hint')}</span>
        </div>
        <TestLine pending={test.isPending} r={test.data} error={test.error} kind={f.kind} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
        <div className="flex flex-col gap-1">
          {target && (
            <>
              <HoldConfirm label={t('targets.delete')} completeLabel={t('targets.deleted')} icon={Trash2}
                disabled={target.used_by.length > 0} className="self-start px-4"
                onConfirm={() => del.mutate(target.id, { onSuccess: back })} />
              {target.used_by.length > 0 && (
                <span className="text-[13px] text-faint">{t('targets.used_note', { count: target.used_by.length })}</span>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Link to="/targets" className={`${pill} text-soft`}>{t('targets.cancel')}</Link>
            <button type="button" disabled={save.isPending} onClick={() => save.mutate(body(), { onSuccess: back })}
              className={`${pill} border-0 bg-brand px-6 text-white`}>
              {save.isPending ? t('targets.saving') : t('targets.save')}
            </button>
          </div>
          {save.error && Object.keys(errs).length === 0 && <span role="alert" className="text-[13px] text-fail">{save.error.message}</span>}
        </div>
      </div>
    </section>
  )
}

function TestLine({ pending, r, error, kind }: { pending: boolean; r?: TargetTest; error: Error | null; kind: TargetIn['kind'] }) {
  const { t } = useTranslation()
  if (pending) return <span role="status" className="text-faint">{t('targets.testing')}</span>
  if (error) return <span role="status" className="font-semibold text-fail">{error.message}</span>
  if (!r) return null
  const text = r.ok
    ? [t(kind === 'drive' ? 'targets.test_drive' : 'targets.test_share', { device: r.device }),
        r.free_bytes != null && t('targets.free', { size: bytes(r.free_bytes) })].filter(Boolean).join(' · ')
    : msg(r.problem)
  return (
    <span role="status" className={cn('flex items-start gap-2 font-semibold', r.ok ? 'text-ok' : 'text-fail')}>
      <StatusIcon status={r.ok ? 'success' : 'failure'} size={18} className="mt-px" />
      <span className="sr-only">{t(r.ok ? 'targets.ok' : 'targets.problem')}: </span>
      <span>{text}</span>
    </span>
  )
}

function Field({ label, hint, error, children }: { label: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{label}</span>
        {children}
      </label>
      {error && <span className="text-[13px] text-fail">{error}</span>}
      {hint && <span className="text-[13px] text-faint">{hint}</span>}
    </div>
  )
}

function Seg<V extends string>({ label, group, value, options, onChange }:
  { label: string; group?: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      <div role="group" aria-label={group ?? label} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-panel2 p-1">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
            className={cn('min-h-11 shrink-0 rounded-full border-0 px-4 font-semibold', v === value ? 'bg-brand text-white' : 'bg-transparent text-soft')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
