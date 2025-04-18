import { api, copyText, listeners } from '@/api/tauri'
import { AnimatedCheckMark } from '@/components/animated-checkmark'
import { QueueContainer } from '@/components/queue-container'
import { QueueItem } from '@/components/queue-item'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import * as events from '@/config/events'
import { sleep, Throttle } from '@/lib/utils'
import { AppState, UploadQueueItem } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { Plus, Ticket, Trash, Trash2 } from 'lucide-react'
import { motion, motionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/_pages/send')({
  component: SendPage,
})

function SendPage() {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const store = AppState.use(
    'uploadDraggedItems',
    'uploadQueue',
    'addToUploadQueue',
    'updateUploadQueueItemProgress',
    'removeFromUploadQueue',
  )
  const dragging = store.uploadDraggedItems.length > 0

  useEffect(() => {
    const throttle = new Throttle(32)

    const unsub = listeners({
      [events.UPLOAD_FILE_ADDED]: (event) => {
        /*  We are clearing this here to prevent the empty message to flicker after drag-drop
         event when the items are cleared and until the file is received from backend. */
        const item = event.payload as events.UploadFileAdded as UploadQueueItem
        item.progress = motionValue(0)
        const queue = AppState.get().uploadQueue
        if (item.name in queue) return
        store.addToUploadQueue(item)
      },

      [events.UPLOAD_FILE_PROGRESS]: (event) => {
        if (throttle.isFree()) {
          const file = event.payload as events.UploadFileProgress
          store.updateUploadQueueItemProgress(file.path, file.progress)
        }
      },

      [events.UPLOAD_FILE_COMPLETED]: (event) => {
        const { name } = event.payload as events.UploadFileCompleted
        store.updateUploadQueueItemProgress(name, 100)
      },

      [events.UPLOAD_FILE_REMOVED]: (event) => {
        const { name } = event.payload as events.UploadFileRemoved
        store.removeFromUploadQueue(name)
      },

      'tauri://drag-enter': async (event) => {
        let uploadQueueSet = new Set(
          Object.values(AppState.get().uploadQueue).map((i) => i.name),
        )
        const paths = event.payload.paths as string[]

        const filesRes = await api.validateFiles(paths)
        if (filesRes.isErr()) return

        const files = filesRes.value.filter(
          (file) => !uploadQueueSet.has(file.name),
        )

        AppState.set({ uploadDraggedItems: files })
        scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      },

      'tauri://drag-leave': () => {
        AppState.set({ uploadDraggedItems: [] })
      },

      'tauri://drag-drop': async () => {
        const store = AppState.get()
        let newQueue: Record<string, UploadQueueItem> = {}

        for (const file of store.uploadDraggedItems.reverse()) {
          newQueue[file.name] = {
            ...file,
            progress: motionValue(0),
            speed: 0,
            done: false,
          }
          api.addFile(file.path)
        }
        newQueue = { ...newQueue, ...store.uploadQueue }
        AppState.set({
          uploadDraggedItems: [],
          uploadQueue: newQueue,
        })
      },
    })

    return unsub
  }, [])

  async function addFilesFromDialog() {
    const paths = await open({ multiple: true })
    if (!paths) return
    for (const path of paths) api.addFile(path)
  }

  const queueSize = Object.values(store.uploadQueue).length

  const showEmptyMessage = !dragging && queueSize == 0

  return (
    <motion.div
      layout
      className='flex flex-1 flex-col gap-2 overflow-x-visible overflow-y-hidden'
    >
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xl font-bold'>{queueSize} files</p>
        <Button
          onClick={api.removeAllFiles}
          variant='destructive'
          className='ml-auto gap-2 px-3 text-xs'
        >
          <Trash2 className='size-3.5!' /> Clear
        </Button>
        <Button onClick={addFilesFromDialog} className='gap-1 px-3 text-xs'>
          <Plus /> Add Files
        </Button>
      </div>
      <QueueContainer ref={scrollAreaRef} data-dragging={dragging}>
        {showEmptyMessage && (
          <motion.div key='empty-state' layout>
            <div className='flex flex-col items-center gap-4 delay-200'>
              <p className='text-muted-foreground mt-5 text-center'>
                Oops! Looks like it's a bit empty here 🤔
                <br />
                Add some files or drag and drop to start sharing the magic! ✨
              </p>
              <Button className='mx-auto' onClick={addFilesFromDialog}>
                <Plus /> Add Files
              </Button>
            </div>
          </motion.div>
        )}
        {store.uploadDraggedItems.map((item) => {
          const queueItem: UploadQueueItem = {
            ...item,
            progress: motionValue(0),
            speed: 0,
            done: false,
          }
          return (
            <div key={'dragging' + item.name} className='opacity-40'>
              <QueueItem item={queueItem} showProgress={false} doneLabel='' />
            </div>
          )
        })}
        {Object.values(store.uploadQueue).map((item) => {
          return (
            <QueueItem
              key={item.name}
              item={item}
              doneLabel='Import complete'
              dropdownContent={
                <DropdownMenuItem
                  onClick={() => api.removeFile(item.path)}
                  className='box-border cursor-pointer border border-transparent bg-gradient-to-br transition-none hover:border-rose-700 hover:from-rose-500 hover:to-rose-600 hover:text-white! hover:text-shadow-sm'
                >
                  <Trash className='mr-2 h-4 w-4' />
                  Delete
                </DropdownMenuItem>
              }
            />
          )
        })}
      </QueueContainer>
      {queueSize > 0 && <CopyTicketButton />}
    </motion.div>
  )
}

function CopyTicketButton() {
  const [copied, setCopied] = useState(false)

  const copyTicket = async () => {
    const ticketRes = await api.generateTicket()
    if (ticketRes.isErr()) return

    const copyRes = await copyText(ticketRes.value)
    if (copyRes.isErr()) return

    setCopied(true)
    await sleep(2000)
    setCopied(false)
  }

  return (
    <Button onClick={copyTicket}>
      {copied ? (
        <AnimatedCheckMark />
      ) : (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <Ticket />
        </motion.div>
      )}{' '}
      <span
        className='animate-in fade-in-0'
        key={'copied:' + copied.toString()}
      >
        {copied ? 'Ticket copied' : 'Copy Ticket'}
      </span>
    </Button>
  )
}
