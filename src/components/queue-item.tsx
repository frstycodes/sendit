import { api } from '@/api/tauri'
import { bytesToString, getFileIcon } from '@/lib/utils'
import { DownloadQueueItem, UploadQueueItem } from '@/state/appstate'
import { motion } from 'motion/react'
import { memo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { EllipsisVertical, Trash } from 'lucide-react'
import { ProgressBar } from './progress-bar'
import { AnimatedCheckMark } from './animated-checkmark'

export type QueueItemProps = {
  item: UploadQueueItem | DownloadQueueItem
  dropdownContent?: React.ReactNode
  doneLabel: string
}

function Internal__QueueItem({
  item: { name, size, progress, ...item },
  dropdownContent,
  doneLabel,
}: QueueItemProps) {
  const hasPath = 'path' in item
  const fileType = name.split('.').pop()?.toLowerCase() || ''
  const icon = getFileIcon(fileType)

  return (
    <motion.div
      layoutId={name}
      initial={{ scale: 0.9, y: -10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0, x: -20000 }}
      transition={{ type: 'spring', duration: 0.3 }}
      className='flex flex-col gap-2 rounded-sm bg-foreground/5 p-2 px-3 shadow-md'
    >
      <div className='flex items-center gap-2'>
        <span className='text-xl'>{icon}</span>
        <div className='truncate'>
          <div className='font-xl flex gap-1 text-sm'>
            <p className='truncate'>{name}</p>
            {progress == 100 && (
              <AnimatedCheckMark tooltipContent={doneLabel} />
            )}
          </div>
          {hasPath && (
            <p className='truncate text-xs text-muted-foreground'>
              {item.path}
            </p>
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

      {progress < 100 && <ProgressBar progress={progress} />}
    </motion.div>
  )
}

export const QueueItem = memo(Internal__QueueItem)
