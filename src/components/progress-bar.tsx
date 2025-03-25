import { motion } from 'motion/react'

type ProgressBarProps = {
  /** Progress percentage */
  progress: number
}
export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <motion.div className='w-full'>
      <div className='h-0.5 w-full bg-muted'>
        <motion.div
          className='h-full rounded-full bg-primary'
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </motion.div>
  )
}
