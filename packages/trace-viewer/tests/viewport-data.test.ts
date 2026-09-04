import { describe, expect, it, vi } from 'vitest'

import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'
import { RequestCoordinator } from '../src/data-source/request-coordinator'
import { ViewportCache, windowBytes, windowKey } from '../src/data-source/viewport-cache'
import type { TraceWindow, TraceWindowRequest } from '../src/model/trace-data'
import { checkTraceDataSource, validateTraceWindow } from '../src/testing'

const source = createArrayTraceSource({ sourceId: 'oracle', timesS: Array.from({ length: 1000 }, (_, i) => i / 100),
  series: { Cz: Array.from({ length: 1000 }, (_, i) => i === 511 ? 1234 : i === 37 ? -567 : Math.sin(i)) } })
const request: TraceWindowRequest = { sourceRevision: '1', startTimeS: 0, durationS: 10,
  channelIds: ['Cz'], pixelWidth: 17, preferredRepresentation: 'auto' }

describe('viewport data contract', () => {
  it('preserves each bucket extremum including off-grid spikes', async () => {
    await checkTraceDataSource(source, [request])
    const window = await source.getWindow(request)
    const points = (await source.getWindow({ ...request, preferredRepresentation: 'points' })).channels.get('Cz')!
    const envelope = window.channels.get('Cz')!
    if (points.representation !== 'points' || envelope.representation !== 'min-max') throw new Error('Wrong representation')
    for (let bucket = 0; bucket < 17; bucket += 1) {
      const values = points.values.slice(Math.floor(bucket * 1000 / 17), Math.floor((bucket + 1) * 1000 / 17))
      expect(envelope.minimum[bucket]).toBe(Math.min(...values))
      expect(envelope.maximum[bucket]).toBe(Math.max(...values))
    }
    expect(Math.max(...envelope.maximum)).toBe(1234)
    expect(Math.min(...envelope.minimum)).toBe(-567)
  })

  it('discards late responses even when the transport ignores cancellation', async () => {
    const deferred: Array<(window: TraceWindow) => void> = []
    const signals: Array<AbortSignal | undefined> = []
    const transport = { ...source, getWindow: vi.fn((_request: TraceWindowRequest, signal?: AbortSignal) => {
      signals.push(signal)
      return new Promise<TraceWindow>((resolve) => deferred.push(resolve))
    }) }
    const cache = new ViewportCache()
    const coordinator = new RequestCoordinator(transport, cache)
    const first = coordinator.request(request).catch((error: unknown) => error)
    const secondRequest = { ...request, startTimeS: 1, durationS: 2 }
    const second = coordinator.request(secondRequest)
    expect(signals[0]?.aborted).toBe(true)
    deferred[1]!(await source.getWindow(secondRequest))
    await second
    deferred[0]!(await source.getWindow(request))
    expect(await first).toMatchObject({ name: 'AbortError' })
    expect(cache.stats.entries).toBe(1)
    await coordinator.request(secondRequest)
    expect(transport.getWindow).toHaveBeenCalledTimes(2)
  })

  it('bounds retained memory and entries with LRU eviction and revision-specific keys', async () => {
    const window = await source.getWindow(request)
    const cache = new ViewportCache(windowBytes(window) * 2 + 100, 2)
    for (let i = 0; i < 100; i += 1) cache.set(String(i), window)
    expect(cache.stats.bytes).toBeLessThanOrEqual(cache.maxBytes)
    expect(cache.stats.entries).toBe(2)
    expect(cache.get('0')).toBeUndefined()
    cache.get('98')
    cache.set('100', window)
    expect(cache.get('99')).toBeUndefined()
    expect(windowKey(source.id, request)).not.toBe(windowKey(source.id, { ...request, sourceRevision: '2' }))
    expect(windowKey(source.id, request)).not.toBe(windowKey(source.id, { ...request, preferredRepresentation: 'points' }))
    const tiny = new ViewportCache(1)
    tiny.set('oversized', window)
    expect(tiny.stats.bytes).toBe(0)
  })

  it('rejects stale revisions and malformed samples before caching', async () => {
    const window = await source.getWindow(request)
    expect(() => validateTraceWindow(source.id, request, { ...window, sourceRevision: 'old' })).toThrow('stale')
    expect(() => validateTraceWindow(source.id, request, { ...window, channels: new Map() })).toThrow('channels')
    const cache = new ViewportCache()
    const coordinator = new RequestCoordinator({ ...source, getWindow: () => Promise.resolve({ ...window, sourceRevision: 'old' }) }, cache)
    await expect(coordinator.request(request)).rejects.toThrow('stale')
    expect(cache.stats.entries).toBe(0)
  })
})
