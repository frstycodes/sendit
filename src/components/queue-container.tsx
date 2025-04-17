import * as React from 'react'
import { ScrollArea } from './ui/scroll-area'
import { AnimatePresence } from 'motion/react'

type QueueContainerProps = Omit<
  React.ComponentProps<typeof ScrollArea>,
  'className'
>

export const QueueContainer = React.forwardRef<
  HTMLDivElement,
  QueueContainerProps
  // @ts-expect-error we disallow passing className
>(({ children, className: _, ...props }, ref) => {
  return (
    <ScrollArea
      ref={ref}
      className='dark:border-foreground/10 border-foreground/15 flex flex-1 overflow-y-auto rounded-md border bg-white/50 transition-all data-[dragging=true]:border-emerald-500 data-[dragging=true]:bg-emerald-500/10 dark:bg-black/20'
      {...props}
    >
      <div className='flex flex-1 flex-col gap-1.5 p-2'>
        <AnimatePresence mode='popLayout'>{children}</AnimatePresence>
      </div>
    </ScrollArea>
  )
})
