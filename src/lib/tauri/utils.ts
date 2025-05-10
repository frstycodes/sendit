import { invoke as tauri__invoke } from '@tauri-apps/api/core'
import {
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

export async function invoke<T>(
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

export function getRandomElFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
