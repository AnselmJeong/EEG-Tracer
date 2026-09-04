import type { TraceDataSource, TraceSeries } from '@neurosignal/trace-viewer'

/** One hour of deterministic signal, generated only for requested channels and samples. */
export function makeLongRecording(channelCount = 128): TraceDataSource {
  const id = `long-${channelCount}`
  const rate = 1000
  return {
    id,
    async getMetadata(signal) {
      await Promise.resolve()
      signal?.throwIfAborted()
      return { sourceId: id, revision: '1', title: 'One-hour lazy recording', startTimeS: 0,
        durationS: 3600, samplingRateHz: rate, annotations: [],
        channels: Array.from({ length: channelCount }, (_, i) => ({ id: `ch-${i}`, label: `EEG ${i + 1}`,
          type: 'eeg' as const, unit: 'µV', bad: false })),
        capabilities: { canMarkBadChannels: false, canEditAnnotations: false } }
    },
    async getWindow(request, signal) {
      await Promise.resolve()
      signal?.throwIfAborted()
      if (request.sourceRevision !== '1') throw new Error('Stale fixture revision')
      const start = Math.ceil(request.startTimeS * rate)
      const end = Math.min(3600 * rate, Math.ceil((request.startTimeS + request.durationS) * rate))
      const count = end - start
      const envelope = request.preferredRepresentation === 'min-max'
        || (request.preferredRepresentation === 'auto' && count > request.pixelWidth * 2)
      const channels = new Map<string, TraceSeries>()
      for (const channel of request.channelIds) {
        signal?.throwIfAborted()
        const phase = Number(channel.slice(3)) * 0.17
        const value = (sample: number) => sample % 7717 === 0 ? 180 : 20 * Math.sin(sample / rate * Math.PI * 20 + phase)
        if (envelope) {
          const buckets = Math.min(request.pixelWidth, count)
          const minimum = new Float32Array(buckets)
          const maximum = new Float32Array(buckets)
          const bucketStartTimesS = new Float64Array(buckets)
          for (let b = 0; b < buckets; b += 1) {
            const from = start + Math.floor(b * count / buckets)
            const to = start + Math.floor((b + 1) * count / buckets)
            let min = Infinity
            let max = -Infinity
            for (let sample = from; sample < to; sample += 1) { const v = value(sample); min = Math.min(min, v); max = Math.max(max, v) }
            minimum[b] = min; maximum[b] = max; bucketStartTimesS[b] = from / rate
          }
          channels.set(channel, { representation: 'min-max', minimum, maximum, bucketStartTimesS })
        } else {
          channels.set(channel, { representation: 'points',
            timesS: Float64Array.from({ length: count }, (_, i) => (start + i) / rate),
            values: Float32Array.from({ length: count }, (_, i) => value(start + i)) })
        }
      }
      return { sourceId: id, sourceRevision: '1', startTimeS: request.startTimeS,
        endTimeS: end / rate, channels, annotations: [] }
    },
  }
}
