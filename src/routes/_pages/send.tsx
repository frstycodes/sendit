import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import {
  bytesToString,
  cn,
  copyText,
  getFileIcon,
  listeners,
} from '../../lib/utils'
import {
  Download,
  EllipsisVertical,
  Plus,
  Ticket,
  Trash,
  Trash2,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { toast } from 'sonner'
import * as events from '../../config/events'
import { AnimatePresence, motion } from 'motion/react'
import { useDropzone } from 'react-dropzone'
import { createFileRoute } from '@tanstack/react-router'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/api/tauri'

type File = events.UploadFileAdded

export const Route = createFileRoute('/_pages/send')({
  component: SendPage,
})

async function generateAndCopyTicket() {
  try {
    const ticket = await api.generateTicket()
    copyText(ticket)
  } catch (err) {
    toast.error('Failed to generate ticket')
    console.error(err)
  }
}

function SendPage() {
  const [files, setFiles] = useState<string[]>([])
  const filesRecord = useRef<Record<string, File>>({})

  useEffect(() => {
    const controller = new AbortController()

    listeners(
      {
        [events.UPLOAD_FILE_ADDED]: (event) => {
          const file = event.payload as File
          toast.loading('Importing file...', {
            id: file.name,
            description: file.path,
          })
          filesRecord.current[file.name] = file
        },
        [events.UPLOAD_FILE_COMPLETED]: (event) => {
          const name = event.payload as events.UploadFileCompleted
          toast.success('File Imported', { id: name, description: name })
          setFiles((prev) => [...prev, name])
        },

        [events.UPLOAD_FILE_REMOVED]: (event) => {
          const name = event.payload as events.UploadFileRemoved
          delete filesRecord.current[name]
          setFiles((prev) => prev.filter((file) => file !== name))
        },
      },
      controller.signal,
    )

    return () => {
      controller.abort()
    }
  }, [files])

  async function handleAddFile() {
    const paths = await open({ multiple: true })

    if (!paths) return
    for (const path of paths) {
      api.addFile(path)
    }
  }

  return (
    <motion.div layout className='flex flex-1 flex-col gap-2 overflow-y-hidden'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xl font-bold'>Added Files</p>
        <Button
          onClick={api.removeAllFiles}
          variant='destructive'
          className='ml-auto h-7 gap-2 px-3 text-xs'
        >
          <Trash2 className='!size-3.5' /> Clear
        </Button>
        <Button onClick={handleAddFile} className='h-7 gap-1 px-3 text-xs'>
          <Plus /> Add Files
        </Button>
      </div>
      <ScrollArea className='flex flex-1 overflow-y-auto rounded-md border bg-background/20 px-3'>
        <div className='flex flex-1 flex-col gap-1.5'>
          <AnimatePresence mode='popLayout'>
            <div>
              {files.length === 0 && (
                <>
                  <motion.p
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='mt-5 text-center text-muted-foreground'
                  >
                    Oops! Looks like it's a bit empty here 🤔
                    <br />
                    Add some files or drag and drop to start sharing the magic!
                    ✨
                    <br />
                    <br />
                    <Button onClick={handleAddFile}>
                      <Plus /> Add Files
                    </Button>
                  </motion.p>
                </>
              )}
            </div>
            {files.map((path) => {
              const file = filesRecord.current[path]
              return <File key={path} file={file} />
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
      {files.length > 0 && (
        <Button onClick={generateAndCopyTicket}>
          <Ticket /> Copy Ticket
        </Button>
      )}
    </motion.div>
  )
}

type FileProps = {
  file: File
}
function File({ file: { size, name, path } }: FileProps) {
  const fileType = name.split('.').pop()?.toLowerCase() || ''
  const icon = getFileIcon(fileType)

  function removeFile() {
    api.removeFile(path)
  }

  return (
    <motion.div
      layoutId={name}
      initial={{ scale: 0.9, y: -10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0, x: -20000 }}
      transition={{ type: 'spring', duration: 0.3 }}
      className='flex items-center gap-2 rounded-sm bg-foreground/5 p-2 px-3 shadow-md'
    >
      <span className='text-xl'>{icon}</span>
      <div className='truncate'>
        <p className='font-xl truncate text-sm'>{name}</p>
        <p className='truncate text-xs text-muted-foreground'>{path}</p>
      </div>
      <p className='ml-auto whitespace-nowrap text-xs text-muted-foreground'>
        {bytesToString(size)}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='p-0'>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={removeFile}
            className='cursor-pointer hover:!bg-rose-400 dark:hover:!bg-rose-600'
          >
            <Trash className='mr-2 h-4 w-4' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  )
}

function Dropzone() {
  const dropzone = useDropzone({})
  console.log(dropzone.isDragAccept)
  return (
    <div
      {...dropzone.getRootProps()}
      className={cn(
        'mt-5 flex h-40 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-foreground/5 text-muted-foreground transition-all',
        dropzone.isDragAccept && 'border-emerald-500 bg-emerald-500/10',
        dropzone.isDragActive && 'border-emerald-500 bg-emerald-500/10',
      )}
    >
      <input {...dropzone.getInputProps()} />
      <Download className='size-8' />
      <p>Drag and drop files here</p>
    </div>
  )
}
