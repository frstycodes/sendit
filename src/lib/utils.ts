import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class Throttle {
  private lastEmitMap: Record<string, number> = {}
  private lastEmit: number = 0

  constructor(private delay: number) {
    this.lastEmit = 0 - delay
  }

  /**
   * Checks if the throttle is free to emit. Returns true if the throttle is free, false otherwise.
   * @param key optional param which allows for throttling of specific keys only
   * @returns
   */
  isFree(key?: string): boolean {
    if (key != undefined) {
      return this.isFree_Key(key)
    }
    return this.isFree_NoKey()
  }

  private isFree_NoKey(): boolean {
    const now = Date.now()
    const elapsed = now - this.lastEmit
    if (elapsed >= this.delay) {
      this.lastEmit = now
      return true
    }
    return false
  }

  private isFree_Key(key: string): boolean {
    const now = Date.now()
    if (!(key in this.lastEmitMap)) {
      this.lastEmitMap[key] = now
      return true
    }
    const lastEmit = this.lastEmitMap[key]

    const elapsed = now - lastEmit
    if (elapsed >= this.delay) {
      this.lastEmitMap[key] = now
      return true
    }
    return false
  }
}

export class Debounce {}

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

export function mapSet<T, U>(set: Set<T>, mapper: (value: T) => U): Set<U> {
  const result = new Set<U>()
  set.forEach((value) => result.add(mapper(value)))
  return result
}
