import { create } from 'zustand'
import { createSelector } from '@/lib/zustand'

export type DownloadQueueItem = {
  name: string
  size: number
  progress: number
}

export type UploadQueueItem = DownloadQueueItem & {
  path: string
}

type AppState = {
  isDownloading: boolean

  downloadQueue: DownloadQueueItem[]
  uploadQueue: UploadQueueItem[]

  uploadProgressMap: Record<string, number>
  downloadProgressMap: Record<string, number>

  addToUploadQueue: (file: AppState['uploadQueue'][0]) => void
  addToDownloadQueue: (file: AppState['downloadQueue'][0]) => void

  removeFromDownloadQueue: (fileName: string) => void
  removeFromUploadQueue: (fileName: string) => void

  updateUploadQueueItemProgress: (path: string, progress: number) => void
  updateDownloadQueueItemProgress: (fileName: string, progress: number) => void

  clearDownloadQueue: () => void
}

const store = create<AppState>((set) => ({
  isDownloading: false,

  downloadQueue: [],
  uploadQueue: [],

  uploadProgressMap: {},
  downloadProgressMap: {},

  addToDownloadQueue: (file: AppState['downloadQueue'][0]) =>
    set((state) => ({
      downloadQueue: [...state.downloadQueue, file],
    })),

  addToUploadQueue: (file: AppState['uploadQueue'][0]) =>
    set((state) => ({
      uploadQueue: [...state.uploadQueue, file],
    })),

  removeFromDownloadQueue: (fileName: string) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.filter(
        (file) => file.name !== fileName,
      ),
    })),

  removeFromUploadQueue: (fileName: string) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((file) => file.name !== fileName),
    })),

  updateUploadQueueItemProgress: (path: string, progress: number) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((file) =>
        file.name === path ? { ...file, progress } : file,
      ),
    })),

  updateDownloadQueueItemProgress: (fileName: string, progress: number) =>
    set((state) => ({
      downloadQueue: state.downloadQueue.map((file) =>
        file.name === fileName ? { ...file, progress } : file,
      ),
    })),

  clearDownloadQueue: () => set({ downloadQueue: [] }),
}))

const use = createSelector(store)

export const AppState = {
  use,
  get: store.getState,
  set: store.setState,
}
