import type { TraceDataSource, TraceWindowRequest } from '../model/trace-data'
import { validateTraceWindow } from '../data-source/validate-window'

export { validateTraceWindow }

/** Transport-independent acceptance harness for consumer-owned adapters. Throws on violations. */
export async function checkTraceDataSource(source: TraceDataSource, requests: readonly TraceWindowRequest[]): Promise<void> {
  const metadata = await source.getMetadata()
  if (metadata.sourceId !== source.id || !metadata.revision || !(metadata.samplingRateHz > 0)
    || !(metadata.durationS > 0) || new Set(metadata.channels.map(({ id }) => id)).size !== metadata.channels.length) {
    throw new Error('Invalid trace metadata.')
  }
  for (const request of requests) {
    if (request.sourceRevision !== metadata.revision) throw new Error('Harness requests must use the current revision.')
    validateTraceWindow(source.id, request, await source.getWindow(request))
  }
  const abort = new AbortController()
  abort.abort()
  for (const operation of [() => source.getMetadata(abort.signal),
    ...requests.slice(0, 1).map((request) => () => source.getWindow(request, abort.signal))]) {
    let rejected = false
    try { await operation() } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') rejected = true
      else throw error
    }
    if (!rejected) throw new Error('Trace source ignored an aborted request.')
  }
}
