import { listeners } from '@/lib/tauri/utils'
import { Loader } from '@/components/loader'
import { QueueContainer } from './-components/queue-container'
import { QueueItem } from './-components/queue-item'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import * as events from '@/lib/tauri/events'
import { Throttle } from '@/utils'
import { AppState, DownloadQueueItem } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { motion, motionValue } from 'motion/react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/tauri'

export const Route = createFileRoute('/_pages/receive')({
  component: ReceivePage,
})

function ReceivePage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const store = AppState.use(
    'isDownloading',
    'clearDownloadQueue',
    'downloadQueue',
    'updateDownloadQueueItemProgress',
    'addToDownloadQueue',
    'removeFromDownloadQueue',
  )

  useEffect(() => {
    const throttle = new Throttle(1000)

    const unsub = listeners({
      [events.DOWNLOAD_FILE_ADDED]: (ev) => {
        const item = ev.payload as events.DownloadFileAdded as DownloadQueueItem
        item.progress = motionValue(0)
        store.addToDownloadQueue(item)
      },

      [events.DOWNLOAD_FILE_PROGRESS]: (ev) => {
        let { name, progress, speed } =
          ev.payload as events.DownloadFileProgress
        if (throttle.isFree(name)) {
          store.updateDownloadQueueItemProgress(name, progress, speed)
        }
      },

      [events.DOWNLOAD_FILE_COMPLETED]: (ev) => {
        let { name } = ev.payload as events.DownloadFileCompleted
        store.updateDownloadQueueItemProgress(name, 100, 0)
      },

      [events.DOWNLOAD_ALL_COMPLETE]: () => {
        AppState.set({ isDownloading: false })
      },

      [events.DOWNLOAD_FILE_ERROR]: (ev) => {
        let { name, error } = ev.payload as events.DownloadFileError
        store.removeFromDownloadQueue(name)
        toast.error(error, {
          description: name,
        })
      },
      [events.DOWNLOAD_FILE_ABORTED]: (ev) => {
        let { name } = ev.payload as events.DownloadFileAborted
        store.removeFromDownloadQueue(name)
        toast('Download canceled', {
          description: name,
        })
      },
    })
    return unsub
  }, [])

  async function download() {
    const ticket = inputRef.current?.value
    if (!ticket) return

    store.clearDownloadQueue()

    const downloadRes = await api.downloadHeader(ticket)
    if (downloadRes.isErr()) return

    const files = downloadRes.value

    for (const file of files) {
      api.downloadFile(file).then((res) => {
        if (res.isOk()) return

        store.removeFromDownloadQueue(file.name)
        toast.error(res.error, {
          description: file.name,
        })
      })
    }

    AppState.set({ isDownloading: true })
  }

  return (
    <div className='flex flex-1 flex-col overflow-y-hidden'>
      <div className='mb-4 flex flex-col gap-2'>
        <Input ref={inputRef} placeholder='Enter ticket' />
        <Button onClick={download}>
          {store.isDownloading && (
            <motion.div
              className='animate-in size-4!'
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
      <QueueContainer>
        {Object.values(store.downloadQueue).map((item) => (
          <QueueItem
            key={item.name}
            item={item}
            dropdownContent={
              !item.done && (
                <DropdownMenuItem
                  onClick={() => api.abortDownload(item.name)}
                  className='cursor-pointer hover:bg-rose-400! dark:hover:bg-rose-600!'
                >
                  Cancel
                </DropdownMenuItem>
              )
            }
            doneLabel='Download complete'
          />
        ))}
      </QueueContainer>
    </div>
  )
}
