/** Sleep for a given number of milliseconds */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Throttle class provides rate limiting based on a delay period.
 * Supports both global and key-specific throttling.
 *
 *
 * Example usage:
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
