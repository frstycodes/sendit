import { emit } from '@tauri-apps/api/event'
import { invoke } from './utils'
import { Theme } from '@/context/theme.context'
import { CANCEL_DOWNLOAD } from './events'
import { DownloadFile, ValidatedFile } from './types'
/**
 * Clean up the database directory.
 */
export function validateFiles(paths: string[]) {
  return invoke<ValidatedFile[]>('validate_files', { paths })
}

/**
 * Clean up the database directory.
 */
export function cleanUp() {
  return invoke<void>('clean_up')
}

/**
 * Add a file to the list.
 * @param path - The path of the file to add.
 */
export function addFile(path: string) {
  return invoke<void>('add_file', { path })
}

/**
 *
 * @param paths - The paths of the files to add.
 * @returns - Array of Results
 */
export function addFiles(paths: string[]) {
  return paths.map((path) => addFile(path))
}

/**
 * Remove a file.
 * @param path - The path of the file to remove.
 */
export function removeFile(path: string) {
  return invoke<void>('remove_file', { path })
}

/**
 * Remove all files from the list.
 * @param path - The path to remove all files from.
 */
export function removeAllFiles() {
  return invoke<void>('remove_all_files', {})
}

/**
 * Generate a doc ticket for a file.
 */
export function generateTicket() {
  return invoke<string>('generate_ticket')
}

/**
 * Download header file using a doc ticket.
 * @param ticket - The doc ticket to use for downloading.
 */
export function downloadHeader(ticket: string) {
  return invoke<DownloadFile[]>('download_header', { ticket })
}

/**
 * Download file.
 * @param file - The file to download.
 */
export function downloadFile(file: DownloadFile) {
  return invoke<void>('download_header', { file })
}

export function getFileIcon(path: string) {
  return invoke<string>('get_file_icon', { path })
}

/**
 * Abort a download using a doc ticket.
 * @param ticket - The doc ticket to use for aborting.
 */
export function abortDownload(name: string) {
  return emit(CANCEL_DOWNLOAD, name)
}

/**
 * Set Theme
 */
export function setTheme(theme: Theme) {
  return invoke<void>('set_theme', { theme })
}
