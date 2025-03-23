import { api } from '@/api/tauri'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as events from '@/config/events'
import { bytesToString, getFileIcon, listeners } from '@/lib/utils'
import { createFileRoute } from '@tanstack/react-router'
import { Check, EllipsisVertical, Trash } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/_pages/receive')({
  component: ReceivePage,
})

type File = {
  name: string
  size: number
  progress: number
}

function ReceivePage() {
  const [files, setFiles] = useState<File[]>([])
  useEffect(() => {
    const controller = new AbortController()

    listeners(
      {
        [events.DOWNLOAD_FILE_ADDED]: (ev) => {
          const file = ev.payload as File
          file.progress = 0
          setFiles((prevFiles) => [...prevFiles, file])
        },
        [events.DOWNLOAD_FILE_PROGRESS]: (ev) => {
          let payload = ev.payload as events.DownloadFileProgress
          console.log(payload.progress)
          setFiles((prev) => {
            const clone = structuredClone(prev)
            const index = clone.findIndex((f) => f.name === payload.name)
            if (index === -1) return prev
            clone[index].progress = payload.progress
            return clone
          })
        },
        [events.DOWNLOAD_FILE_COMPLETED]: (ev) => {
          let file_name = ev.payload as events.DownloadFileCompleted
          setFiles((prev) => {
            const clone = structuredClone(prev)
            const index = clone.findIndex((f) => f.name === file_name)
            if (index === -1) return prev
            clone[index].progress = 100
            return clone
          })
        },
      },
      controller.signal,
    )
    return () => {
      controller.abort()
    }
  }, [])
  const inputRef = useRef<HTMLInputElement>(null)
  const handleDownload = () => {
    const ticket = inputRef.current?.value
    if (!ticket) return

    api.download(ticket)
  }
  return (
    <div className='flex flex-1 flex-col overflow-y-hidden'>
      <div className='mb-4 flex flex-col gap-2'>
        <Input ref={inputRef} placeholder='Enter ticket' />
        <Button onClick={handleDownload}>Download</Button>
      </div>
      <div className='flex flex-1 flex-col overflow-y-hidden rounded-md border bg-background/20 py-2'>
        <ScrollArea className='h-full overflow-y-auto'>
          <div className='flex flex-col gap-2 px-2'>
            {files.map((file) => (
              <FileItem
                name={file.name}
                size={file.size}
                progress={file.progress}
                key={file.name}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

type FileItemProps = {
  name: string
  size: number
  progress: number
  onDelete?: () => void
  className?: string
}

export function FileItem({ name, size, progress }: FileItemProps) {
  const fileExt = name.split('.').pop()!

  return (
    <motion.div
      layoutId={name}
      initial={{ scale: 0.9, y: -10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0, x: -20000 }}
      transition={{ type: 'spring', duration: 0.3 }}
      className='relative overflow-hidden rounded-sm bg-foreground/5 p-2 px-3 shadow-md'
    >
      {/* {progress <= 100 && ( */}
      <div
        className='absolute left-0 top-0 h-0.5 rounded-full bg-primary transition-all'
        style={{ width: `${progress}%` }}
      />
      {/* )} */}
      <div className='flex items-center gap-2'>
        <span className='text-xl'>{getFileIcon(fileExt)}</span>
        <div className='truncate'>
          <div className='flex items-center gap-1'>
            <p className='font-xl truncate text-sm'>{name}</p>
            {progress == 100 && <DownloadedIcon />}
          </div>
          <p className='truncate text-xs text-muted-foreground'>
            {bytesToString(size)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='ml-auto p-0'>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {}}
              className='cursor-pointer hover:!bg-rose-400 dark:hover:!bg-rose-600'
            >
              <Trash className='mr-2 h-4 w-4' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* <div className='bg-background relative h-0.5 w-[95%] mx-auto rounded-full'> */}
      {/* </div> */}
    </motion.div>
  )
}

function DownloadedIcon() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
      <Check className='!size-3 rounded-full bg-emerald-500 stroke-[6px] p-0.5 text-muted' />
    </motion.div>
  )
}
