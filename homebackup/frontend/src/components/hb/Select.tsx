import { useId } from 'react'
import { Select as Root, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type SelectOption = { value: string | null; label: string }

// Radix Select can't hold an empty or null value, so those travel under sentinels.
const NULL = '__null__'
const EMPTY = '__empty__'
const encode = (v: string | null) => (v === null ? NULL : v === '' ? EMPTY : v)
const decode = (v: string) => (v === NULL ? null : v === EMPTY ? '' : v)

/** The app's dropdown: shadcn/Radix Select in the design's field style, with a visible label. */
export function Select({ label, value, onChange, options, hideLabel, invalid, className, id }: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  options: SelectOption[]
  hideLabel?: boolean
  invalid?: boolean
  className?: string
  id?: string
}) {
  const auto = useId()
  const triggerId = id ?? auto
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={triggerId} className={hideLabel ? 'sr-only' : 'text-[13px] font-semibold text-soft'}>{label}</label>
      <Root value={encode(value)} onValueChange={(v) => onChange(decode(v))}>
        <SelectTrigger id={triggerId} aria-invalid={invalid || undefined}
          className="h-11! w-full rounded-[10px] border border-field-line bg-field px-3 text-sm text-foreground shadow-none data-placeholder:text-faint aria-invalid:border-fail">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="rounded-xl border border-line bg-panel p-1 text-foreground shadow-lg ring-0">
          {options.map((o) => (
            <SelectItem key={encode(o.value)} value={encode(o.value)}
              className="min-h-10 rounded-lg px-3 text-sm focus:bg-accent focus:text-accent-foreground">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Root>
    </div>
  )
}
