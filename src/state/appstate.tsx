import { ValidatedFile } from '@/api/tauri'
import { createSelector } from '@/lib/zustand'
import { create } from 'zustand'

export type DownloadQueueItem = {
  name: string
  icon: string
  size: number
  progress: number
  speed: number
}

export type UploadQueueItem = DownloadQueueItem & {
  path: string
}

type ProgressVal = {
  progress: number
  speed: number
}
type AppState = {
  isDownloading: boolean

  downloadQueue: DownloadQueueItem[]
  uploadQueue: UploadQueueItem[]
  uploadDraggedItems: ValidatedFile[]

  uploadProgressMap: Record<string, number>
  downloadProgressMap: Record<string, ProgressVal>

  addToUploadQueue: (file: AppState['uploadQueue'][0]) => void
  addToDownloadQueue: (file: AppState['downloadQueue'][0]) => void

  removeFromDownloadQueue: (fileName: string) => void
  removeFromUploadQueue: (fileName: string) => void

  updateUploadQueueItemProgress: (path: string, progress: number) => void
  updateDownloadQueueItemProgress: (
    fileName: string,
    progress: number,
    speed: number,
  ) => void

  clearDownloadQueue: () => void
}

const store = create<AppState>((set) => ({
  isDownloading: false,

  downloadQueue: [],
  uploadQueue: [],
  uploadDraggedItems: [],

  uploadProgressMap: {},
  downloadProgressMap: {},

  addToDownloadQueue: (file: AppState['downloadQueue'][0]) =>
    set((state) => ({
      downloadQueue: [...state.downloadQueue, file],
    })),

  addToUploadQueue: (file: AppState['uploadQueue'][0]) =>
    set((state) => ({
      uploadQueue: [file, ...state.uploadQueue],
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

  updateUploadQueueItemProgress: (filename: string, progress: number) => {
    set((s) => ({
      uploadQueue: s.uploadQueue.map((file) =>
        file.name === filename ? { ...file, progress } : file,
      ),
    }))
  },

  updateDownloadQueueItemProgress: (
    filename: string,
    progress: number,
    speed: number,
  ) => {
    set((s) => ({
      downloadQueue: s.downloadQueue.map((file) =>
        file.name === filename ? { ...file, progress, speed } : file,
      ),
    }))
  },

  clearDownloadQueue: () => set({ downloadQueue: [] }),
}))

const use = createSelector(store)

export const AppState = {
  use,
  get: store.getState,
  set: store.setState,
}
