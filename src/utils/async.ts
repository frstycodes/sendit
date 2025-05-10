/** Sleep for a given number of milliseconds */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * # Throttle
 * Throttle class provides rate limiting based on a delay period.
 * Supports both global and key-specific throttling.
 *
 * __Example usage:__
 * ```ts
 * const throttle = new Throttle(1000); // 1 second delay
 * if (throttle.isFree()) {
 *   // perform operation
 * }
 * ```
 */
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

/**
 * # Throttled Queue
 * ThrottledQueue class provides a queue mechanism with a maximum size and a timeout-based release system.
 * Items are added to the queue, and when the queue reaches its maximum size or the timeout expires,
 * the queue is released via a callback function.
 *
 * __Example usage:__
 * ```ts
 * const queue = new ThrottledQueue<string>(5, 1000); // Max size 5, timeout 1 second
 * queue.onRelease((items) => {
 *   console.log('Released items:', items);
 * });
 * queue.add('item1');
 * queue.add('item2');
 * ```
 */
export class ThrottledQueue<T> {
  private queue: T[] = []
  private releaseCallback: (queue: T[]) => void = () => {}
  private timerId: number | null = null

  constructor(
    private size = 10,
    private timeout = 200,
  ) {
    this.startTimer()
  }

  private release() {
    if (this.queue.length > 0) {
      // Only release if the queue is not empty
      this.releaseCallback(this.queue)
      this.queue = []
    }
  }

  private startTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
    }
    this.timerId = setTimeout(() => {
      this.release()
      this.startTimer()
    }, this.timeout)
  }

  find(predicate: (a: T) => boolean) {
    return this.queue.find(predicate)
  }

  onRelease(cb: typeof this.releaseCallback) {
    this.releaseCallback = cb
  }

  add(item: T) {
    this.queue.push(item)
    if (this.queue.length >= this.size) {
      this.release()
      this.startTimer()
    }
  }
}
