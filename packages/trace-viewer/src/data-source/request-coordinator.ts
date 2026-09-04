import type { TraceDataSource, TraceWindow, TraceWindowRequest } from '../model/trace-data'
import { validateTraceWindow } from './validate-window'
import { windowKey } from './viewport-cache'
import type { ViewportCache } from './viewport-cache'

/** One foreground request per layer; late responses cannot populate the cache. */
export class RequestCoordinator {
  private active: AbortController | undefined
  private generation = 0

  constructor(private source: TraceDataSource, private cache: ViewportCache) {}

  cancel(): void { this.generation += 1; this.active?.abort() }

  async request(request: TraceWindowRequest, signal?: AbortSignal): Promise<TraceWindow> {
    this.cancel()
    const generation = this.generation
    const controller = new AbortController()
    this.active = controller
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      if (signal?.aborted) controller.abort()
      controller.signal.throwIfAborted()
      const key = windowKey(this.source.id, request)
      const cached = this.cache.get(key)
      if (cached !== undefined) return cached
      const window = await this.source.getWindow(request, controller.signal)
      controller.signal.throwIfAborted()
      if (generation !== this.generation) throw new DOMException('Superseded viewport', 'AbortError')
      validateTraceWindow(this.source.id, request, window)
      this.cache.set(key, window)
      return window
    } finally {
      signal?.removeEventListener('abort', abort)
    }
  }
}
