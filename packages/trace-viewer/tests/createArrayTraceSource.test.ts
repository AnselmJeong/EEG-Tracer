import { describe, expect, it } from 'vitest'

import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'

describe('createArrayTraceSource', () => {
  it('returns immutable metadata and requested point windows', async () => {
    const original = [0, 2, Number.NaN, -1]
    const source = createArrayTraceSource({
      sourceId: 'short-eeg',
      timesS: [0, 0.5, 1, 1.5],
      series: { Fp1: original },
    })
    original[1] = 999
    const metadata = await source.getMetadata()
    const window = await source.getWindow({
      sourceRevision: metadata.revision,
      startTimeS: 0.5,
      durationS: 1,
      channelIds: ['Fp1'],
      pixelWidth: 300,
      preferredRepresentation: 'auto',
    })

    expect(metadata.channels[0]).toMatchObject({ id: 'Fp1', unit: 'µV', bad: false })
    expect(window.channels.get('Fp1')).toMatchObject({ representation: 'points' })
    const points = window.channels.get('Fp1')
    expect(points?.representation === 'points' ? [...points.timesS] : []).toEqual([0.5, 1])
    expect(points?.representation === 'points' ? points.values[0] : 0).toBe(2)
    expect(points?.representation === 'points' ? Number.isNaN(points.values[1] ?? 0) : false).toBe(true)
  })

  it('preserves a narrow spike in min-max envelopes', async () => {
    const timesS = Float64Array.from({ length: 1000 }, (_, index) => index / 100)
    const values = new Float32Array(1000)
    values[503] = 125
    const source = createArrayTraceSource({ sourceId: 'spike', timesS, series: { Cz: values } })
    const metadata = await source.getMetadata()
    const window = await source.getWindow({
      sourceRevision: metadata.revision,
      startTimeS: 0,
      durationS: 10,
      channelIds: ['Cz'],
      pixelWidth: 100,
      preferredRepresentation: 'auto',
    })
    const series = window.channels.get('Cz')
    expect(series?.representation).toBe('min-max')
    expect(series?.representation === 'min-max' ? Math.max(...series.maximum) : 0).toBe(125)
  })

  it('rejects stale revisions and aborted requests', async () => {
    const source = createArrayTraceSource({ sourceId: 'revision', revision: 'two', timesS: [0, 1], series: { C3: [0, 1] } })
    await expect(source.getWindow({
      sourceRevision: 'one', startTimeS: 0, durationS: 1, channelIds: ['C3'], pixelWidth: 10, preferredRepresentation: 'points',
    })).rejects.toThrow('revision mismatch')
    const controller = new AbortController()
    controller.abort()
    await expect(source.getMetadata(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
