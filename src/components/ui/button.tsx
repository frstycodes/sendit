import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils'

export const buttonStyles = {
  default:
    'bg-white/90 dark:bg-white/5 hover:bg-white/10 dark:border-black/30 border-b-black/12 dark:border-b-initial dark:border-t-white/5 text-foreground border light:shadow-xs',
  destructive:
    'border bg-rose-500 dark:bg-rose-600 text-white text-shadow-sm dark:border-black/30 border-black/5 light:border-b-black/15 dark:border-t-white/20 light:shadow-xs hover:bg-rose-600',
}

const buttonVariants = cva(
  'inline-flex active:translate-y-[2px] active:scale-97 box-border cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[4px] text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        ...buttonStyles,
        default_gr:
          'button-gr-secondary shadow-sm dark:bg-foreground/10 text-foreground dark:hover:bg-foreground/15 hover:bg-foreground/5',
        destructive_gr:
          'button-gr-primary shadow-sm text-shadow-sm text-destructive-foreground dark:hover:bg-rose-500 hover:bg-rose-600',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-foreground/10 rounded-sm aspect-square hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        data-variant={variant}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
