import { ValidatedFile } from '@/lib/tauri'
import { User } from '@/lib/tauri/api'
import { createSelector } from '@/lib/zustand'
import { MotionValue } from 'motion/react'
import { create } from 'zustand'

export type UploadQueueItem = {
  name: string
  icon: string
  size: number
  progress: MotionValue<number>
  done: boolean
  path: string
}

export type DownloadQueueItem = UploadQueueItem & {
  speed: number
}

type AppState = {
  user: User | null
  isDownloading: boolean

  downloadQueue: Record<string, DownloadQueueItem>
  uploadQueue: Record<string, UploadQueueItem>
  uploadDraggedItems: ValidatedFile[]

  addToUploadQueue: (files: UploadQueueItem[]) => void
  addToDownloadQueue: (file: DownloadQueueItem) => void

  removeFromDownloadQueue: (fileName: string) => void
  removeFromUploadQueue: (fileName: string) => void

  updateUploadQueueItemProgress: (path: string, progress: number) => void
  updateDownloadQueueItemProgress: (
    fileName: string,
    progress: number,
    speed: number,
  ) => void

  updateDownloadQueueItemPath: (name: string, path: string) => void
  clearDownloadQueue: () => void
  reorderUploadQueue: () => void
}

const store = create<AppState>((set, get) => ({
  user: null,
  isDownloading: false,

  downloadQueue: {},
  uploadQueue: {},
  uploadDraggedItems: [],

  addToDownloadQueue: (file: DownloadQueueItem) =>
    set((state) => ({
      downloadQueue: { ...state.downloadQueue, [file.name]: file },
    })),

  addToUploadQueue: (files: UploadQueueItem[]) =>
    set((s) => {
      const queue = { ...s.uploadQueue }
      for (const file of files) {
        queue[file.name] = file
      }
      return { uploadQueue: queue }
    }),

  removeFromDownloadQueue: (fileName: string) =>
    set((state) => {
      const downloadQueue = { ...state.downloadQueue }
      delete downloadQueue[fileName]
      return { downloadQueue }
    }),

  removeFromUploadQueue: (fileName: string) =>
    set((state) => {
      const uploadQueue = { ...state.uploadQueue }
      delete uploadQueue[fileName]
      return { uploadQueue }
    }),

  updateUploadQueueItemProgress: (filename: string, progress: number) => {
    const entry = get().uploadQueue[filename]
    entry!.progress.set(progress)
    if (progress < 100) return

    set((s) => ({
      uploadQueue: {
        ...s.uploadQueue,
        [filename]: {
          ...entry,
          done: true,
        },
      },
    }))
  },

  updateDownloadQueueItemProgress: (
    filename: string,
    progress: number,
    speed: number,
  ) => {
    const entry = get().downloadQueue[filename]
    entry!.progress.set(progress)

    return set((state) => ({
      downloadQueue: {
        ...state.downloadQueue,
        [filename]: {
          ...entry,
          speed,
          done: progress == 100,
        },
      },
    }))
  },

  updateDownloadQueueItemPath: (filename: string, path: string) => {
    const entry = get().downloadQueue[filename]
    return set((state) => ({
      downloadQueue: {
        ...state.downloadQueue,
        [filename]: {
          ...entry,
          path,
        },
      },
    }))
  },
  clearDownloadQueue: () => set({ downloadQueue: {} }),

  reorderUploadQueue: () => {
    const uploadQueue = get().uploadQueue
    const newQueue: Record<string, UploadQueueItem> = {}
    Object.keys(uploadQueue)
      .sort((a, b) => Number(uploadQueue[b].size) - Number(uploadQueue[a].size))
      .forEach((key) => {
        newQueue[key] = uploadQueue[key]
      })
    return set({ uploadQueue: newQueue })
  },
}))

const use = createSelector(store)

export const AppState = {
  use,
  get: store.getState,
  set: store.setState,
}
