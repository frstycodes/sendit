import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          'peer border-foreground/10 bg-foreground/10 file:text-foreground placeholder:text-muted-foreground flex h-8 w-full rounded-[calc(var(--radius)-6px)] border border-b-2 px-3 py-2 text-base transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium focus:border-b-2 focus:border-b-rose-500 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
