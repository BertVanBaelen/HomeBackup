import SmoothTab from '@/components/kokonutui/smooth-tab'
import { cn } from '@/lib/utils'

export type SegmentOption<T extends string> = { value: T; label: string }

/**
 * Every tab-like choice in the app (filters, Drive/Share, UUID/Label, language) uses Kokonut's swipe tabs,
 * tab bar only, so the indicator slides the same way everywhere.
 */
export function Segmented<T extends string>({ label, value, onChange, options, className }: {
  label: string
  value: T
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  className?: string
}) {
  return (
    <SmoothTab
      tabsOnly
      label={label}
      value={value}
      onChange={(id) => onChange(id as T)}
      items={options.map((o) => ({ id: o.value, title: o.label }))}
      className={cn('w-auto max-w-full items-start [&>div]:justify-start', className)}
      listClassName="overflow-x-auto border border-line bg-panel"
      tabClassName="min-h-11 px-4 py-0 text-sm font-semibold text-soft hover:text-foreground"
      activeColor="bg-brand"
      activeTextColor="text-white"
    />
  )
}
