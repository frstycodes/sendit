// DOWNLOAD
//
export const DOWNLOAD_FILE_ADDED = 'DOWNLOAD_FILE_ADDED'
export const DOWNLOAD_FILE_PROGRESS = 'DOWNLOAD_FILE_PROGRESS'
export const DOWNLOAD_FILE_COMPLETED = 'DOWNLOAD_FILE_COMPLETED'

export type DownloadFileAdded = {
  name: string
  size: number
}
export type DownloadFileProgress = {
  name: string
  progress: number
}
export type DownloadFileCompleted = string

// UPLOAD
export const UPLOAD_FILE_ADDED = 'UPLOAD_FILE_ADDED'
export const UPLOAD_FILE_PROGRESS = 'UPLOAD_FILE_PROGRESS'
export const UPLOAD_FILE_COMPLETED = 'UPLOAD_FILE_COMPLETED'
export const UPLOAD_FILE_REMOVED = 'UPLOAD_FILE_REMOVED'

export type UploadFileAdded = {
  name: string
  path: string
  size: number
}
export type UploadFileProgress = {
  path: string
  progress: number
}
export type UploadFileCompleted = string
export type UploadFileRemoved = string
