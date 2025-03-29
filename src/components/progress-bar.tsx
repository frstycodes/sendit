import { bytesToString, throttle } from '@/lib/utils'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

type ProgressBarProps = {
  /** Progress percentage */
  progress: number
  showPercentage?: boolean
  speed?: number
}
export function ProgressBar({
  progress,
  showPercentage,
  speed,
}: ProgressBarProps) {
  const [throttledSpeed, setThrottledSpeed] = useState(speed ?? 0)

  const updateThrottledSpeed = useCallback(throttle(setThrottledSpeed, 500), [])

  useEffect(() => {
    if (speed === undefined) return
    updateThrottledSpeed(speed)
  }, [speed])

  return (
    <motion.div className='w-full'>
      <div className='w-full gap-2 bg-muted'>
        <motion.div
          className='h-1 rounded-full bg-primary shadow-sm'
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
              {bytesToString(throttledSpeed * 1000_000)}/s
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
