import { bytesToString } from '@/lib/utils'
import { motion } from 'motion/react'
import { memo } from 'react'

type ProgressBarProps = {
  /** Progress percentage */
  progress: number
  showPercentage?: boolean
  speed?: number
}

export const ProgressBar = memo(Internal__ProgressBar)
function Internal__ProgressBar({
  progress,
  showPercentage,
  speed,
}: ProgressBarProps) {
  return (
    <motion.div className='w-full'>
      <div className='w-full gap-2 bg-muted'>
        <motion.div
          className='h-1 rounded-full bg-primary shadow-sm transition-all'
          style={{ width: `${progress}%` }}
        />
        <div className='flex items-center justify-between'>
          {showPercentage && (
            <p className='mt-1 text-xs text-muted-foreground'>
              {progress.toFixed(0)}%
            </p>
          )}

          {!!speed && (
            <p className='mt-1 text-xs text-muted-foreground'>
              {bytesToString(speed * 1000_000)}/s
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
