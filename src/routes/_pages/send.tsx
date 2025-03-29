import { api } from '@/api/tauri'
import { AnimatedCheckMark } from '@/components/animated-checkmark'
import { QueueItem } from '@/components/queue-item'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import * as events from '@/config/events'
import { listeners } from '@/lib/utils'
import { AppState, UploadQueueItem } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { Plus, Ticket, Trash, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

export const Route = createFileRoute('/_pages/send')({
  component: SendPage,
})

function SendPage() {
  const store = AppState.use(
    'uploadQueue',
    'addToUploadQueue',
    'updateUploadQueueItemProgress',
    'removeFromUploadQueue',
  )

  useEffect(() => {
    const unsub = listeners({
      [events.UPLOAD_FILE_ADDED]: (event) => {
        const item = event.payload as events.UploadFileAdded as UploadQueueItem
        item.progress = 0
        store.addToUploadQueue(item)
      },

      [events.UPLOAD_FILE_PROGRESS]: (event) => {
        const file = event.payload as events.UploadFileProgress
        store.updateUploadQueueItemProgress(file.path, file.progress)
      },

      [events.UPLOAD_FILE_COMPLETED]: (event) => {
        const name = event.payload as events.UploadFileCompleted
        store.updateUploadQueueItemProgress(name, 100)
      },

      [events.UPLOAD_FILE_REMOVED]: (event) => {
        const name = event.payload as events.UploadFileRemoved
        store.removeFromUploadQueue(name)
      },
    })

    return unsub
  }, [])

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
          onClick={() => api.removeAllFiles().catch(console.error)}
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
              {store.uploadQueue.length === 0 && (
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
            {store.uploadQueue.map((item) => {
              return (
                <QueueItem
                  key={item.path}
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
        </div>
      </ScrollArea>
      {store.uploadQueue.length > 0 && <CopyTicketButton />}
    </motion.div>
  )
}

function CopyTicketButton() {
  const [copied, setCopied] = useState(false)

  const copyTicket = async () => {
    try {
      const ticket = await api.generateTicket()
      await writeText(ticket)
      setCopied(true)
    } catch (error) {
      console.error('Failed to copy ticket:', error)
    } finally {
      setTimeout(() => setCopied(false), 1000)
    }
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
