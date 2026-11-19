import type { ReactNode } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'

/**
 * Bottom sheet in the style of Kokonut's smooth drawer: rounded top, small grab handle, drag down to close.
 * Used for "do something" moments: a new or edited target, picking a source folder.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="mx-auto w-full max-w-[760px] rounded-t-3xl border border-b-0 border-line bg-panel text-foreground outline-none data-[vaul-drawer-direction=bottom]:max-h-[92vh] [&>div:first-child]:hidden">
        <div className="flex h-full max-h-[92vh] flex-col">
          <div aria-hidden className="flex h-6 shrink-0 items-center justify-center">
            <span className="h-1 w-9 rounded-full bg-line2" />
          </div>
          <div className="shrink-0 px-6 pt-1 pb-3">
            <DrawerTitle className="font-heading text-xl font-semibold tracking-[-0.01em] text-foreground">{title}</DrawerTitle>
            {description && <DrawerDescription className="mt-0.5 text-faint">{description}</DrawerDescription>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
