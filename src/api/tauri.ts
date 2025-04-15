import { invoke as tauri__invoke } from '@tauri-apps/api/core'
import {
  emit,
  EventCallback,
  EventName,
  Options,
  listen as tauri__listen,
} from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import * as log from '@tauri-apps/plugin-log'
import { revealItemInDir as tauri__revealItemInDir } from '@tauri-apps/plugin-opener'
import { err, ok, Result } from 'neverthrow'
import { toast } from 'sonner'
import * as events from '@/config/events'

export async function revealItemInDir(
  path: string,
): Promise<Result<void, string>> {
  try {
    await tauri__revealItemInDir(path)
    return ok()
  } catch (e) {
    return err(e as string)
  }
}

export async function copyText(text: string): Promise<Result<void, string>> {
  try {
    await writeText(text)
    return ok()
  } catch (e) {
    return err(e as string)
  }
}

async function invoke<T>(
  command: string,
  args?: any,
): Promise<Result<T, string>> {
  try {
    const res: T = await tauri__invoke(command, args)
    return ok(res)
  } catch (error) {
    let e = error as string
    console.log(e)
    toast.error(e)
    log.error(e)
    return err(e)
  }
}

export type ValidatedFile = {
  name: string
  icon: string
  path: string
  size: number
}

export async function listen<T>(
  event: EventName,
  callback: EventCallback<T>,
  options?: Options & { signal?: AbortSignal },
) {
  const { signal, ...opts } = options ?? {}
  const unsub = tauri__listen(event, callback, opts)

  signal?.addEventListener('abort', () => unsub.then((f) => f()))
  return unsub
}

export function listeners(
  record: Partial<Record<EventName, EventCallback<any>>>,
): () => void {
  const controller = new AbortController()

  for (const [event, callback] of Object.entries(record)) {
    if (!callback) continue
    listen(event, callback, { signal: controller.signal })
  }
  return () => {
    controller.abort()
  }
}

type DownloadFile = {
  name: string
  icon: string
  size: number
  hash: string
}

export const api = {
  /**
   * Clean up the database directory.
   */
  validateFiles: (paths: string[]) =>
    invoke<ValidatedFile[]>('validate_files', { paths }),

  /**
   * Clean up the database directory.
   */
  cleanUp: () => invoke<void>('clean_up'),

  /**
   * Add a file to the list.
   * @param path - The path of the file to add.
   */
  addFile: (path: string) => invoke<void>('add_file', { path }),

  /**
   * Remove a file.
   * @param path - The path of the file to remove.
   */
  removeFile: (path: string) => invoke<void>('remove_file', { path }),

  /**
   * Remove all files from the list.
   * @param path - The path to remove all files from.
   */
  removeAllFiles: () => invoke<void>('remove_all_files', {}),

  /**
   * Generate a doc ticket for a file.
   */
  generateTicket: () => invoke<string>('generate_ticket'),

  /**
   * Download header file using a doc ticket.
   * @param ticket - The doc ticket to use for downloading.
   */
  downloadHeader: (ticket: string) =>
    invoke<DownloadFile[]>('download_header', { ticket }),

  /**
   * Download file.
   * @param file - The file to download.
   */
  downloadFile: (file: DownloadFile) =>
    invoke<void>('download_header', { file }),

  getFileIcon: (path: string) => invoke<string>('get_file_icon', { path }),

  /**
   * Abort a download using a doc ticket.
   * @param ticket - The doc ticket to use for aborting.
   */
  abortDownload: (name: string) => emit(events.CANCEL_DOWNLOAD, name),
}
