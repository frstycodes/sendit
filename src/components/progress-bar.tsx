import { bytesToString } from '@/lib/utils'
import { motion, MotionValue, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'

type ProgressBarProps = {
  /** Progress percentage */
  progress: MotionValue<number>
  showPercentage?: boolean
  speed?: number
}

export function ProgressBar({
  progress,
  showPercentage,
  speed,
}: ProgressBarProps) {
  const progressPercentageStr = useTransform(progress, (x) => `${x}%`)
  const [progressPercentage, setProgressPercentage] = useState(0)

  useEffect(() => {
    const unsub = progress.on('change', (newP) =>
      setProgressPercentage(Math.round(newP)),
    )
    return unsub
  }, [])

  return (
    <div className='w-full'>
      <div className='w-full gap-2 bg-muted'>
        <motion.div
          className='h-1 rounded-full bg-primary shadow-sm transition-[width] duration-75'
          style={{
            width: progressPercentageStr,
            willChange: 'width',
          }}
        />
        <div className='flex items-center justify-between'>
          {showPercentage && (
            <p className='mt-1 text-xs text-muted-foreground'>
              {progressPercentage}%
            </p>
          )}

          {!!speed && (
            <p className='mt-1 text-xs text-muted-foreground'>
              {bytesToString(speed * 1000_000)}/s
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
