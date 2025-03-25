import { invoke } from '@tauri-apps/api/core'

export const api = {
  /**
   * Add a file to the list.
   * @param path - The path of the file to add.
   */
  addFile: async (path: string): Promise<void> => {
    return await invoke('add_file', { path })
  },
  /**
   * Remove a file.
   * @param path - The path of the file to remove.
   */
  removeFile: async (path: string): Promise<void> => {
    return await invoke('remove_file', { path })
  },
  /**
   * Remove all files from the list.
   * @param path - The path to remove all files from.
   */
  removeAllFiles: async (): Promise<void> => {
    return await invoke('remove_all_files')
  },
  /**
   * Generate a doc ticket for a file.
   */
  generateTicket: async (): Promise<string> => {
    return await invoke('generate_ticket')
  },
  /**
   * Download files using a doc ticket.
   * @param ticket - The doc ticket to use for downloading.
   */
  download: (ticket: string): Promise<void> => {
    return invoke('download_file', { ticket })
  },
  /**
   * Abort a download using a doc ticket.
   * @param ticket - The doc ticket to use for aborting.
   */
  abortDownload: async (path: string): Promise<void> => {
    return await invoke('abort_download', { path })
  },
}
