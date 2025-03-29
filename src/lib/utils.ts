import {
  EventCallback,
  EventName,
  listen as listen_tauri,
  Options,
} from '@tauri-apps/api/event'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function throttle<F extends (...args: any[]) => void>(
  fn: F,
  delay: number,
): F {
  let isThrottled = false
  let savedArgs: Parameters<F> | null = null

  function wrapper(this: any, ...args: Parameters<F>) {
    if (isThrottled) {
      savedArgs = args
      return
    }

    fn.apply(this, args)
    isThrottled = true

    setTimeout(() => {
      isThrottled = false
      if (savedArgs) {
        wrapper.apply(this, savedArgs)
        savedArgs = null
      }
    }, delay)
  }

  return wrapper as F
}

export async function listen<T>(
  event: EventName,
  callback: EventCallback<NoInfer<T>>,
  options?: Options & { signal?: AbortSignal },
) {
  const { signal, ...opts } = options ?? {}
  const unsub = listen_tauri(event, callback, opts)

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

export function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return '📄'
    case 'doc':
    case 'docx':
      return '📝'
    case 'xls':
    case 'xlsx':
      return '📊'
    case 'ppt':
    case 'pptx':
      return '📑'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
      return '🖼️'
    case 'mp3':
    case 'wav':
    case 'ogg':
      return '🎵'
    case 'mp4':
    case 'mov':
    case 'avi':
      return '🎥'
    case 'zip':
    case 'rar':
    case '7z':
      return '📦'
    case 'exe':
      return '⚙️'
    case 'txt':
      return '📄'
    default:
      return '📄'
  }
}

export function bytesToString(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}
