// DOWNLOAD
//
export const DOWNLOAD_FILE_ADDED = 'DOWNLOAD_FILE_ADDED'
export const DOWNLOAD_FILE_PROGRESS = 'DOWNLOAD_FILE_PROGRESS'
export const DOWNLOAD_FILE_COMPLETED = 'DOWNLOAD_FILE_COMPLETED'
export const DOWNLOAD_ALL_COMPLETE = 'DOWNLOAD_ALL_COMPLETE'
export const DOWNLOAD_FILE_ERROR = 'DOWNLOAD_FILE_ERROR'
export const DOWNLOAD_FILE_ABORTED = 'DOWNLOAD_FILE_ABORTED'
export const CANCEL_DOWNLOAD = 'CANCEL_DOWNLOAD'

export type DownloadFileAdded = {
  name: string
  icon: string
  size: number
}
export type DownloadFileProgress = {
  name: string
  progress: number
  speed: number // bytes per microsecond
}
export type DownloadFileCompleted = { name: string; path: string }

export type DownloadFileAborted = {
  name: string
  reason: string
}

export type DownloadFileError = {
  name: string
  error: string
}

// UPLOAD
export const UPLOAD_FILE_ADDED = 'UPLOAD_FILE_ADDED'
export const UPLOAD_FILE_PROGRESS = 'UPLOAD_FILE_PROGRESS'
export const UPLOAD_FILE_COMPLETED = 'UPLOAD_FILE_COMPLETED'
export const UPLOAD_FILE_REMOVED = 'UPLOAD_FILE_REMOVED'
export const UPLOAD_FILE_ERROR = 'UPLOAD_FILE_ERROR'

export type UploadFileAdded = {
  name: string
  icon: string
  path: string
  size: number
}
export type UploadFileProgress = {
  path: string
  progress: number
}
export type UploadFileCompleted = { name: string }
export type UploadFileRemoved = { name: string }
export type UploadFileError = {
  name: string
  error: string
}
