import { api } from '@/api/tauri'
import { Loader } from '@/components/loader'
import { QueueItem } from '@/components/queue-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as events from '@/config/events'
import { listeners } from '@/lib/utils'
import { AppState, DownloadQueueItem } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

export const Route = createFileRoute('/_pages/receive')({
  component: ReceivePage,
})

function ReceivePage() {
  const store = AppState.use(
    'isDownloading',
    'clearDownloadQueue',
    'downloadQueue',
    'updateDownloadQueueItemProgress',
    'addToDownloadQueue',
    'removeFromDownloadQueue',
  )

  useEffect(() => {
    const unsub = listeners({
      [events.DOWNLOAD_FILE_ADDED]: (ev) => {
        const item = ev.payload as events.DownloadFileAdded as DownloadQueueItem
        item.progress = 0
        store.addToDownloadQueue(item)
      },

      [events.DOWNLOAD_FILE_PROGRESS]: (ev) => {
        let { name, progress } = ev.payload as events.DownloadFileProgress
        store.updateDownloadQueueItemProgress(name, progress)
      },

      [events.DOWNLOAD_FILE_COMPLETED]: (ev) => {
        let name = ev.payload as events.DownloadFileCompleted
        store.updateDownloadQueueItemProgress(name, 100)
      },

      [events.DOWNLOAD_ALL_COMPLETE]: () => {
        AppState.set({ isDownloading: false })
      },
    })
    return unsub
  }, [])

  const inputRef = useRef<HTMLInputElement>(null)
  const handleDownload = () => {
    const ticket = inputRef.current?.value
    if (!ticket) return

    store.clearDownloadQueue()
    api.download(ticket).catch(console.error)
    AppState.set({ isDownloading: true })
  }
  return (
    <div className='flex flex-1 flex-col overflow-y-hidden'>
      <div className='mb-4 flex flex-col gap-2'>
        <Input ref={inputRef} placeholder='Enter ticket' />
        <Button onClick={handleDownload}>
          {store.isDownloading && (
            <motion.div
              className='size-4! animate-in'
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Loader />
            </motion.div>
          )}
          <motion.span layout>
            {store.isDownloading ? 'Downloading...' : 'Download'}
          </motion.span>
        </Button>
      </div>
      <div className='flex flex-1 flex-col overflow-y-hidden rounded-md border bg-background/20 py-2'>
        <ScrollArea className='h-full overflow-y-auto'>
          <div className='flex flex-col gap-2 px-2'>
            {store.downloadQueue.map((item) => (
              <QueueItem
                key={item.name}
                item={item}
                doneLabel='Download complete'
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
