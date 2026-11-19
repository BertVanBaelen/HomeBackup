import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type Entry, useBrowse } from '@/api/client'
import { bytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Sheet } from './Sheet'

/** Lazy tree of the read-only source folders: folders open on demand and can be selected; files are shown, not picked. */
export function FolderTree({ selected, onSelect }: { selected: string; onSelect: (path: string) => void }) {
  const { t } = useTranslation()
  const roots = useBrowse(null)
  return (
    <ul role="tree" aria-label={t('picker.tree')} className="m-0 flex list-none flex-col p-0">
      {roots.isPending && <li className="py-2 text-faint">{t('picker.loading')}</li>}
      {roots.data?.entries.map((e) => <Node key={e.path} entry={e} depth={0} selected={selected} onSelect={onSelect} />)}
    </ul>
  )
}

function Node({ entry, depth, selected, onSelect }: { entry: Entry; depth: number; selected: string; onSelect: (p: string) => void }) {
  const { t } = useTranslation()
  // folders on the way to the current selection start open
  const [open, setOpen] = useState(() => entry.dir && selected.startsWith(entry.path + '/'))
  const children = useBrowse(entry.path, entry.dir && open)
  const indent = { paddingLeft: 8 + depth * 20 }

  if (!entry.dir) {
    return (
      <li role="treeitem" aria-selected={false} className="flex min-h-9 items-center gap-2 text-[13px] text-faint" style={{ ...indent, paddingLeft: indent.paddingLeft + 28 }}>
        <File aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{entry.name}</span>
        {entry.size != null && <span className="ml-auto shrink-0 pr-2 tabular-nums">{bytes(entry.size)}</span>}
      </li>
    )
  }
  const isSelected = selected.replace(/\/$/, '') === entry.path
  const Icon = open ? FolderOpen : Folder
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={isSelected}>
      <div className={cn('flex min-h-11 items-center gap-1 rounded-lg', isSelected && 'bg-accent text-accent-foreground')} style={indent}>
        <button type="button" onClick={() => setOpen(!open)} aria-label={t(open ? 'picker.close' : 'picker.open', { name: entry.name })}
          className="flex size-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-faint hover:text-foreground">
          <ChevronRight aria-hidden className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </button>
        <button type="button" onClick={() => onSelect(entry.path)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border-0 bg-transparent px-1 text-left text-sm font-medium text-inherit">
          <Icon aria-hidden className={cn('size-4 shrink-0', isSelected ? 'text-accent-foreground' : 'text-accent-ink')} />
          <span className="truncate font-mono text-[13px]">{depth === 0 ? entry.path : entry.name}</span>
        </button>
      </div>
      {open && (
        <ul role="group" className="m-0 list-none p-0">
          {children.isPending && <li className="py-1 text-[13px] text-faint" style={{ paddingLeft: 36 + depth * 20 }}>{t('picker.loading')}</li>}
          {children.data?.entries.length === 0 && <li className="py-1 text-[13px] text-faint" style={{ paddingLeft: 36 + depth * 20 }}>{t('picker.empty')}</li>}
          {children.data?.entries.map((c) => <Node key={c.path} entry={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
          {children.data?.truncated && <li className="py-1 text-[13px] text-faint" style={{ paddingLeft: 36 + depth * 20 }}>{t('picker.truncated')}</li>}
        </ul>
      )}
    </li>
  )
}

/** Source folder input plus a Browse button that opens the tree in a bottom sheet. */
export function SourceField({ label, hint, value, onChange, error }: {
  label: string; hint?: string; value: string; onChange: (path: string) => void; error?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(value)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="source-field" className="text-[13px] font-semibold text-soft">{label}</label>
      <div className="flex gap-2">
        <input id="source-field" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined}
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-field-line bg-field px-3 font-mono text-[13px] text-foreground aria-invalid:border-fail" />
        <button type="button" onClick={() => { setPick(value); setOpen(true) }}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line2 bg-transparent px-4 font-semibold text-foreground">
          <FolderOpen aria-hidden className="size-4" />{t('picker.browse')}
        </button>
      </div>
      {error ? <span className="text-[12.5px] text-fail">{error}</span> : hint && <span className="text-[12.5px] text-faint">{hint}</span>}
      <Sheet open={open} onOpenChange={setOpen} title={t('picker.title')} description={t('picker.description')}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-[13px] text-soft">{pick ? t('picker.selected', { path: pick }) : t('picker.none')}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="min-h-11 rounded-full border border-line2 bg-transparent px-5 font-semibold text-foreground">{t('picker.cancel')}</button>
              <button type="button" disabled={!pick} onClick={() => { onChange(pick); setOpen(false) }}
                className="min-h-11 rounded-full border-0 bg-brand px-5 font-semibold text-white disabled:opacity-50">{t('picker.use')}</button>
            </div>
          </div>
        }>
        {open && <FolderTree selected={pick} onSelect={setPick} />}
      </Sheet>
    </div>
  )
}
