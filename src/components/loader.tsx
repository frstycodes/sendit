import { cn } from '@/utils'
import { AnimatePresence, motion } from 'motion/react'

type LoaderProps = {
  className?: string
  show?: boolean
}
export function Loader(props: LoaderProps) {
  return (
    <AnimatePresence mode='popLayout'>
      {props.show && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={cn(
            'animate-spin-ease size-3 rounded-md border-t border-b',
            props.className,
          )}
        />
      )}
    </AnimatePresence>
  )
}
