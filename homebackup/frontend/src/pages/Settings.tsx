import { type ChangeEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type Settings as SettingsT, fieldErrors, useCheckConfig, useConfigStatus, useRefreshTypes, useSaveSettings,
  useScripts, useSettings, useTypes,
} from '@/api/client'
import { Segmented } from '@/components/hb/Segmented'
import { Select } from '@/components/hb/Select'
import { StatusIcon } from '@/components/hb/Status'
import { cn } from '@/lib/utils'

const HOOKS = ['hook_success', 'hook_warning', 'hook_failure'] as const
const LANGS = ['auto', 'en', 'nl'] as const
const LEVELS = ['info', 'warning', 'debug'] as const
const FIELD = 'min-h-11 rounded-[10px] border border-field-line bg-field px-3 text-foreground'
const GHOST = 'inline-flex min-h-11 items-center justify-center rounded-full border border-line2 bg-transparent px-[18px] font-semibold text-foreground disabled:opacity-50'

export function Settings() {
  const { t } = useTranslation()
  const saved = useSettings().data
  const scripts = useScripts().data ?? []
  const config = useConfigStatus().data
  const types = useTypes().data
  const save = useSaveSettings()
  const check = useCheckConfig()
  const refresh = useRefreshTypes()
  // Local edits; undefined means "showing the saved values".
  const [edit, setEdit] = useState<SettingsT>()
  if (!saved) return null
  const form = edit ?? saved
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const errs = fieldErrors(save.error)
  const set = (patch: Partial<SettingsT>) => setEdit({ ...form, ...patch })
  const num = (k: 'overdue_days' | 'keep_runs' | 'keep_days') =>
    ({ type: 'number', min: 1, value: Number.isNaN(form[k]) ? '' : form[k], onChange: (e: ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.valueAsNumber }) })

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-heading text-[26px] font-semibold tracking-[-0.01em]">{t('settings.title')}</h1>
        <span className="text-faint">{t('settings.sub')}</span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Section id="set-hooks" title={t('settings.hooks')} hint={t('settings.hooks_hint')}>
            {HOOKS.map((k) => {
              const v = form[k] ?? null
              // Keep a saved script selectable even when HA no longer lists it.
              const options = v && !scripts.includes(v) ? [v, ...scripts] : scripts
              return (
                <div key={k} className="flex flex-col gap-1.5">
                  <Select label={t(`settings.${k}`)} value={v} onChange={(x) => set({ [k]: x || null })} invalid={!!errs[k]}
                    options={[{ value: null, label: t('settings.none') }, ...options.map((s) => ({ value: s, label: s }))]} />
                  <Err msg={errs[k]} />
                </div>
              )
            })}
          </Section>

          <Section id="set-warn" title={t('settings.overdue')} hint={t('settings.overdue_hint')}>
            <label className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold">{t('settings.after')}</span>
              <input {...num('overdue_days')} className={cn(FIELD, 'w-22')} />
              <span className="font-semibold">{t('settings.days_unit')}</span>
            </label>
            <Err msg={errs.overdue_days} />
          </Section>

          <Section id="set-keep" title={t('settings.keep')} hint={t('settings.keep_hint')}>
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold">{t('settings.keep_runs')}</span>
                <input {...num('keep_runs')} className={cn(FIELD, 'w-30')} />
                <Err msg={errs.keep_runs} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-semibold">{t('settings.keep_days')}</span>
                <input {...num('keep_days')} className={cn(FIELD, 'w-30')} />
                <Err msg={errs.keep_days} />
              </label>
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Section id="set-lang" title={t('settings.lang_time')}>
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold">{t('settings.language')}</span>
              <Segmented label={t('settings.language')} value={form.language} onChange={(l) => set({ language: l })}
                options={LANGS.map((l) => ({ value: l, label: t(`settings.lang_${l}`) }))} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('settings.time_zone')}</span>
              <span>{form.time_zone}</span>
              <span className="text-[13px] text-faint">{t('settings.time_zone_hint')}</span>
            </div>
          </Section>

          <Section id="set-log" title={t('settings.logging')} hint={t('settings.logging_hint')}>
            <div className="flex flex-col gap-1.5">
              <Select label={t('settings.log_level')} value={form.log_level} invalid={!!errs.log_level}
                onChange={(l) => set({ log_level: l as SettingsT['log_level'] })}
                options={LEVELS.map((l) => ({ value: l, label: t(`settings.level_${l}`) }))} />
              <Err msg={errs.log_level} />
            </div>
          </Section>

          <Section id="set-cfg" title={t('settings.config')} hint={t('settings.config_hint')}>
            {config && (
              <>
                <span className="rounded-[10px] border border-line bg-background p-3 font-mono text-[12.5px] text-soft [overflow-wrap:anywhere]">
                  {config.path}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('flex flex-[1_1_200px] items-start gap-2 font-semibold', config.valid ? 'text-ok' : 'text-fail')}>
                    <StatusIcon status={config.valid ? 'success' : 'failure'} size={18} className="mt-px" />
                    <span className="[overflow-wrap:anywhere]">
                      {config.valid
                        ? t('settings.config_valid', {
                          items: t('settings.n_items', { count: config.items }),
                          targets: t('settings.n_targets', { count: config.targets }),
                        })
                        : config.error}
                    </span>
                  </span>
                  <button type="button" onClick={() => check.mutate()} disabled={check.isPending} className={GHOST}>
                    {t('settings.check')}
                  </button>
                </div>
              </>
            )}
          </Section>

          <Section id="set-types" title={t('settings.types')} hint={t('settings.types_hint')}>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {types?.map((ty) => (
                <li key={ty.id} className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{ty.name}</span>
                    <span className="font-mono text-[12.5px] text-faint">{ty.id}</span>
                    <span className="text-[13px] text-faint">· {t(ty.builtin ? 'settings.builtin' : 'settings.user_type')}</span>
                  </span>
                  {ty.error && <span className="text-[13px] text-fail [overflow-wrap:anywhere]">{ty.error}</span>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending} className={cn(GHOST, 'self-start')}>
              {t('settings.refresh')}
            </button>
          </Section>

          <section aria-labelledby="set-priv" className="flex items-start gap-3 rounded-2xl border border-line bg-panel2 px-6 py-5">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-accent-ink">
              <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z M9 12l2 2 4-4" />
            </svg>
            <div className="flex flex-col gap-1">
              <h2 id="set-priv" className="m-0 text-[15px] font-semibold">{t('settings.private')}</h2>
              <span className="text-soft">{t('settings.private_text')}</span>
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
        <span className={save.isError && !Object.keys(errs).length ? 'text-fail' : 'text-faint'}>
          {save.isError && !Object.keys(errs).length ? save.error.message : t('settings.applies')}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setEdit(undefined); save.reset() }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border-0 bg-transparent px-[18px] font-semibold text-soft">
            {t('settings.cancel')}
          </button>
          <button type="button" disabled={!dirty || save.isPending}
            onClick={() => save.mutate(form, { onSuccess: () => setEdit(undefined) })}
            className="inline-flex min-h-11 items-center justify-center rounded-full border-0 bg-brand px-6 font-semibold text-white disabled:opacity-50">
            {t('settings.save')}
          </button>
        </div>
      </div>
    </>
  )
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="m-0 font-heading text-lg font-semibold">{title}</h2>
        {hint && <span className="text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

const Err = ({ msg }: { msg?: string }) => (msg ? <span role="alert" className="text-[13px] text-fail">{msg}</span> : null)
