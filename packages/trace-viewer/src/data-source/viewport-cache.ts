import type { TraceWindow, TraceWindowRequest } from '../model/trace-data'

export function windowKey(sourceId: string, request: TraceWindowRequest): string {
  return JSON.stringify([sourceId, request.sourceRevision, request.channelIds, request.startTimeS,
    request.durationS, request.pixelWidth, request.preferredRepresentation])
}

export function windowBytes(window: TraceWindow): number {
  // Count retained buffers, not just views; shared time arrays count once.
  const buffers = new Set<ArrayBufferLike>()
  for (const series of window.channels.values()) {
    const arrays = series.representation === 'points'
      ? [series.timesS, series.values]
      : [series.bucketStartTimesS, series.minimum, series.maximum]
    for (const array of arrays) buffers.add(array.buffer)
  }
  return [...buffers].reduce((total, buffer) => total + buffer.byteLength, 0)
    + JSON.stringify(window.annotations).length * 2 + 256
}

/** Viewer-local LRU. No recording-wide or global cache is retained. */
export class ViewportCache {
  private entries = new Map<string, { window: TraceWindow; bytes: number }>()
  private bytes = 0

  constructor(readonly maxBytes = 64 * 1024 * 1024, readonly maxEntries = 24) {}

  get stats() { return { bytes: this.bytes, entries: this.entries.size } }

  get(key: string): TraceWindow | undefined {
    const entry = this.entries.get(key)
    if (entry === undefined) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.window
  }

  set(key: string, window: TraceWindow): void {
    const previous = this.entries.get(key)
    if (previous !== undefined) { this.bytes -= previous.bytes; this.entries.delete(key) }
    const bytes = windowBytes(window) + key.length * 2
    if (bytes > this.maxBytes || this.maxEntries <= 0) return
    this.entries.set(key, { window, bytes })
    this.bytes += bytes
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.entries().next().value
      if (oldest === undefined) break
      this.bytes -= oldest[1].bytes
      this.entries.delete(oldest[0])
    }
  }

  clear(): void { this.entries.clear(); this.bytes = 0 }
}
