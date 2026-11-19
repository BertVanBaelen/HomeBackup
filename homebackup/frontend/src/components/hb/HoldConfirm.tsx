import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import HoldButton from '@/components/kokonutui/hold-button'
import { cn } from '@/lib/utils'

type Props = Omit<ComponentProps<typeof HoldButton>, 'onHoldComplete' | 'children'> & {
  label: string
  onConfirm: () => void
  icon: LucideIcon
  /** Round 44 px icon button: the label is read out and shown as a tooltip only. */
  iconOnly?: boolean
}

/** Hold-to-confirm for consequential actions (delete, mirror on, cancel run, run now). A short click does nothing. */
export function HoldConfirm({ label, onConfirm, icon, iconOnly, className, holdDuration = 1000, completeLabel = label, ...rest }: Props) {
  const { t } = useTranslation()
  return (
    <HoldButton
      {...rest}
      icon={icon}
      holdDuration={holdDuration}
      onHoldComplete={onConfirm}
      title={iconOnly ? `${label} · ${t('dashboard.keep_holding')}` : undefined}
      aria-label={iconOnly ? label : undefined}
      holdingLabel={iconOnly ? <span className="sr-only">{t('dashboard.keep_holding')}</span> : t('dashboard.keep_holding')}
      completeLabel={iconOnly ? <span className="sr-only">{completeLabel}</span> : completeLabel}
      className={cn('min-h-11 rounded-full font-semibold', iconOnly && 'size-11 min-w-0 border-0 px-0 [&_svg]:size-5', className)}
    >
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </HoldButton>
  )
}
