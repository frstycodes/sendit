import { api, copyText, listeners } from '@/api/tauri'
import { AnimatedCheckMark } from '@/components/animated-checkmark'
import { QueueItem } from '@/components/queue-item'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as events from '@/config/events'
import { sleep, Throttle } from '@/lib/utils'
import { AppState, UploadQueueItem } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { Plus, Ticket, Trash, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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
        AppState.set({ uploadDraggedItems: [] })
        const item = event.payload as events.UploadFileAdded as UploadQueueItem
        item.progress = 0
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
          AppState.get().uploadQueue.map((i) => i.name),
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
        for (const file of AppState.get().uploadDraggedItems.reverse()) {
          api.addFile(file.path)
        }
      },
    })

    return unsub
  }, [])

  async function addFilesFromDialog() {
    const paths = await open({ multiple: true })
    if (!paths) return
    for (const path of paths) api.addFile(path)
  }

  const showEmptyMessage = !dragging && store.uploadQueue.length == 0
  return (
    <motion.div
      layout
      className='flex flex-1 flex-col gap-2 overflow-y-hidden overflow-x-visible'
    >
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xl font-bold'>{store.uploadQueue.length} files</p>
        <Button
          onClick={api.removeAllFiles}
          variant='destructive'
          className='ml-auto h-7 gap-2 px-3 text-xs'
        >
          <Trash2 className='!size-3.5' /> Clear
        </Button>
        <Button onClick={addFilesFromDialog} className='h-7 gap-1 px-3 text-xs'>
          <Plus /> Add Files
        </Button>
      </div>
      <ScrollArea
        ref={scrollAreaRef}
        data-dragging={dragging}
        className='flex flex-1 overflow-y-auto rounded-md border bg-background p-2 transition-all data-[dragging=true]:border-emerald-500 data-[dragging=true]:bg-emerald-500/10 dark:bg-background/20'
      >
        <motion.div className='flex flex-1 flex-col gap-1.5'>
          <AnimatePresence mode='popLayout'>
            {showEmptyMessage && (
              <motion.div key='empty-state' layout>
                <div className='flex flex-col items-center gap-4 delay-200'>
                  <p className='mt-5 text-center text-muted-foreground'>
                    Oops! Looks like it's a bit empty here 🤔
                    <br />
                    Add some files or drag and drop to start sharing the magic!
                    ✨
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
                progress: 0,
                speed: 0,
              }
              return (
                <div key={'dragging' + item.name} className='opacity-40'>
                  <QueueItem
                    item={queueItem}
                    showProgress={false}
                    doneLabel=''
                  />
                </div>
              )
            })}
            {store.uploadQueue.map((item) => {
              return (
                <QueueItem
                  key={item.name}
                  item={item}
                  doneLabel='Import complete'
                  dropdownContent={
                    <DropdownMenuItem
                      onClick={() => {
                        api
                          .removeFile(item.path)
                          .then(() => {
                            console.log('File removed successfully')
                          })
                          .catch((err) => console.log(err))
                      }}
                      className='cursor-pointer hover:!bg-rose-400 dark:hover:!bg-rose-600'
                    >
                      <Trash className='mr-2 h-4 w-4' />
                      Delete
                    </DropdownMenuItem>
                  }
                />
              )
            })}
          </AnimatePresence>
        </motion.div>
      </ScrollArea>
      {store.uploadQueue.length > 0 && <CopyTicketButton />}
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
    toast.success('Ticket copied to clipboard', {
      position: 'top-left',
      richColors: true,
    })
    await sleep(1000)
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
      Copy Ticket
    </Button>
  )
}
