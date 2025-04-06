import { revealItemInDir } from '@/api/tauri'
import { bytesToString, getFileIcon } from '@/lib/utils'
import { DownloadQueueItem, UploadQueueItem } from '@/state/appstate'
import { EllipsisVertical } from 'lucide-react'
import { motion, MotionStyle } from 'motion/react'
import { memo } from 'react'
import { AnimatedCheckMark } from './animated-checkmark'
import { ProgressBar } from './progress-bar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export type QueueItemProps = {
  item: UploadQueueItem | DownloadQueueItem
  dropdownContent?: React.ReactNode
  doneLabel: string
  style?: MotionStyle
  showProgress?: boolean
}

export const QueueItem = memo(Internal__QueueItem)
function Internal__QueueItem({
  item: { name, icon, size, progress, ...item },
  style,
  dropdownContent,
  doneLabel,
  showProgress = true,
}: QueueItemProps) {
  const hasPath = 'path' in item
  const fileType = name.split('.').pop()?.toLowerCase() || ''

  const iconEl = icon ? (
    <div className='aspect-square w-10'>
      <img src={icon} />
    </div>
  ) : (
    getFileIcon(fileType)
  )

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, y: -10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      style={style}
      transition={{ type: 'spring', duration: 0.3 }}
      className='flex flex-col gap-2 rounded-sm border bg-muted p-2 px-3 shadow-sm dark:shadow-md'
    >
      <div className='flex items-center gap-2'>
        <span className='text-xl'>{iconEl}</span>
        <div className='truncate'>
          <div className='font-xl flex gap-1 text-sm'>
            <p className='truncate'>{name}</p>
            {progress == 100 && (
              <AnimatedCheckMark tooltipContent={doneLabel} />
            )}
          </div>
          {hasPath && (
            <a
              onClick={() => revealItemInDir(item.path)}
              className='cursor-pointer truncate text-[0.6rem] text-muted-foreground hover:underline'
            >
              {item.path.replace(/\\/g, '/')}
            </a>
          )}
        </div>
        <p className='ml-auto whitespace-nowrap text-xs text-muted-foreground'>
          {bytesToString(size)}
        </p>
        {dropdownContent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='p-0'>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>{dropdownContent}</DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {showProgress && progress < 100 && (
        <ProgressBar showPercentage progress={progress} speed={item.speed} />
      )}
    </motion.div>
  )
}
