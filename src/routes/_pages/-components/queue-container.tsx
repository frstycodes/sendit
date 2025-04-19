import * as React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
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
      className='relative flex flex-1 overflow-y-scroll transition-all'
      {...props}
    >
      <div className='flex flex-1 flex-col gap-1.5 py-0.5'>
        <AnimatePresence mode='popLayout'>{children}</AnimatePresence>
      </div>
    </ScrollArea>
  )
})
