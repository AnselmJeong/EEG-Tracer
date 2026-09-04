import { READ_ONLY_TRACE_CAPABILITIES } from '../model/capabilities'
import type { TraceCapabilities } from '../model/capabilities'
import type { TraceChannel } from '../model/channel'
import type {
  TraceAnnotation,
  TraceDataSource,
  TraceMetadata,
  TraceSeries,
  TraceWindow,
  TraceWindowRequest,
} from '../model/trace-data'

export interface ArrayTraceSourceOptions {
  sourceId: string
  revision?: string
  title?: string
  timesS: ArrayLike<number>
  series: Readonly<Record<string, ArrayLike<number>>>
  channels?: readonly TraceChannel[]
  unit?: string
  annotations?: readonly TraceAnnotation[]
  capabilities?: Partial<TraceCapabilities>
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Trace request was aborted.', 'AbortError')
  }
}

function lowerBound(values: Float64Array, target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const value = values[middle]
    if (value !== undefined && value < target) low = middle + 1
    else high = middle
  }
  return low
}

function copyPointSeries(
  timesS: Float64Array,
  values: Float32Array,
  start: number,
  end: number,
): TraceSeries {
  return {
    representation: 'points',
    timesS: timesS.slice(start, end),
    values: values.slice(start, end),
  }
}

function createEnvelopeSeries(
  timesS: Float64Array,
  values: Float32Array,
  start: number,
  end: number,
  pixelWidth: number,
): TraceSeries {
  const sampleCount = end - start
  const bucketCount = Math.max(0, Math.min(Math.floor(pixelWidth), sampleCount))
  const bucketStartTimesS = new Float64Array(bucketCount)
  const minimum = new Float32Array(bucketCount)
  const maximum = new Float32Array(bucketCount)

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const bucketStart = start + Math.floor((bucket * sampleCount) / bucketCount)
    const bucketEnd = start + Math.floor(((bucket + 1) * sampleCount) / bucketCount)
    bucketStartTimesS[bucket] = timesS[bucketStart] ?? 0
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (let index = bucketStart; index < Math.max(bucketStart + 1, bucketEnd); index += 1) {
      const value = values[index]
      if (value === undefined || !Number.isFinite(value)) continue
      min = Math.min(min, value)
      max = Math.max(max, value)
    }

    minimum[bucket] = min === Number.POSITIVE_INFINITY ? Number.NaN : min
    maximum[bucket] = max === Number.NEGATIVE_INFINITY ? Number.NaN : max
  }

  return { representation: 'min-max', bucketStartTimesS, minimum, maximum }
}

function samplingRate(timesS: Float64Array): number {
  if (timesS.length < 2) return 1
  const differences: number[] = []
  for (let index = 1; index < timesS.length; index += 1) {
    const current = timesS[index]
    const previous = timesS[index - 1]
    if (current !== undefined && previous !== undefined) differences.push(current - previous)
  }
  differences.sort((a, b) => a - b)
  const median = differences[Math.floor(differences.length / 2)] ?? 1
  if (median <= 0) return 1
  const inferred = 1 / median
  const rounded = Math.round(inferred)
  return Math.abs(inferred - rounded) <= Math.max(1, inferred) * 1e-9 ? rounded : inferred
}

function validateInput(options: ArrayTraceSourceOptions, timesS: Float64Array): void {
  if (!options.sourceId.trim()) throw new Error('sourceId must not be empty.')
  if (timesS.length === 0) throw new Error('timesS must contain at least one sample.')
  for (let index = 0; index < timesS.length; index += 1) {
    const value = timesS[index]
    if (value === undefined || !Number.isFinite(value)) throw new Error('timesS must contain only finite values.')
    if (index > 0 && value <= (timesS[index - 1] ?? value)) {
      throw new Error('timesS must be strictly increasing.')
    }
  }

  const channelIds = options.channels?.map(({ id }) => id) ?? Object.keys(options.series)
  if (channelIds.length === 0) throw new Error('series must contain at least one channel.')
  if (new Set(channelIds).size !== channelIds.length) throw new Error('Channel IDs must be unique.')
  for (const channelId of channelIds) {
    const values = options.series[channelId]
    if (values === undefined) throw new Error(`Missing series for channel ${channelId}.`)
    if (values.length !== timesS.length) {
      throw new Error(`Channel ${channelId} has ${values.length} samples; expected ${timesS.length}.`)
    }
  }

  const annotations = options.annotations ?? []
  const annotationIds = annotations.map(({ id }) => id)
  if (new Set(annotationIds).size !== annotationIds.length) throw new Error('Annotation IDs must be unique.')
  for (const annotation of annotations) {
    if (!annotation.id.trim() || !annotation.label.trim()) throw new Error('Annotation IDs and labels must not be empty.')
    if (!Number.isFinite(annotation.startTimeS) || !Number.isFinite(annotation.durationS) || annotation.durationS < 0) {
      throw new Error(`Annotation ${annotation.id} must use a finite start time and non-negative duration.`)
    }
  }
}

export function createArrayTraceSource(options: ArrayTraceSourceOptions): TraceDataSource {
  const timesS = Float64Array.from(options.timesS)
  validateInput(options, timesS)

  const sourceChannels: readonly TraceChannel[] = options.channels ?? Object.keys(options.series).map((id): TraceChannel => ({
    id,
    label: id,
    type: 'eeg',
    unit: options.unit ?? 'µV',
    bad: false,
  }))
  const channels: readonly TraceChannel[] = Object.freeze(sourceChannels.map((channel) => Object.freeze({
    ...channel,
    ...(channel.position === undefined ? {} : { position: Object.freeze({ ...channel.position }) }),
  })))
  const valuesByChannel = new Map<string, Float32Array>()
  for (const channel of channels) {
    const values = options.series[channel.id]
    if (values !== undefined) valuesByChannel.set(channel.id, Float32Array.from(values))
  }

  const firstTime = timesS[0] ?? 0
  const lastTime = timesS[timesS.length - 1] ?? firstTime
  const rate = samplingRate(timesS)
  const durationS = Math.max(1 / rate, lastTime - firstTime + 1 / rate)
  const revision = options.revision ?? '1'
  const annotations = Object.freeze((options.annotations ?? []).map((annotation) => Object.freeze({ ...annotation })))
  const capabilities = Object.freeze({ ...READ_ONLY_TRACE_CAPABILITIES, ...options.capabilities })
  const metadata: TraceMetadata = Object.freeze({
    sourceId: options.sourceId,
    revision,
    ...(options.title === undefined ? {} : { title: options.title }),
    startTimeS: firstTime,
    durationS,
    samplingRateHz: rate,
    channels,
    annotations,
    capabilities,
  })

  return {
    id: options.sourceId,
    getMetadata(signal?: AbortSignal): Promise<TraceMetadata> {
      return Promise.resolve().then(() => {
        abortIfNeeded(signal)
        return metadata
      })
    },
    getWindow(request: TraceWindowRequest, signal?: AbortSignal): Promise<TraceWindow> {
      return Promise.resolve().then(() => {
        abortIfNeeded(signal)
        if (request.sourceRevision !== revision) {
          throw new Error(`Trace revision mismatch: requested ${request.sourceRevision}, current ${revision}.`)
        }
        if (!Number.isFinite(request.startTimeS) || !Number.isFinite(request.durationS) || request.durationS <= 0) {
          throw new Error('Trace window duration must be positive and finite.')
        }
        if (!Number.isInteger(request.pixelWidth) || request.pixelWidth < 1) throw new Error('pixelWidth must be a positive integer.')
        if (new Set(request.channelIds).size !== request.channelIds.length) throw new Error('Requested channel IDs must be unique.')

        const requestStart = Math.max(firstTime, request.startTimeS)
        const requestEnd = Math.min(firstTime + durationS, request.startTimeS + request.durationS)
        if (requestStart >= requestEnd) throw new Error('Requested time window is outside the recording.')
        const start = Math.min(timesS.length, lowerBound(timesS, requestStart))
        const end = Math.max(start, Math.min(timesS.length, lowerBound(timesS, requestEnd)))
        const channelsWindow = new Map<string, TraceSeries>()

        for (const channelId of request.channelIds) {
          abortIfNeeded(signal)
          const values = valuesByChannel.get(channelId)
          if (values === undefined) throw new Error(`Unknown channel ID: ${channelId}.`)
          const sampleCount = end - start
          const useEnvelope = request.preferredRepresentation === 'min-max'
            || (request.preferredRepresentation === 'auto' && sampleCount > Math.max(1, request.pixelWidth) * 2)
          channelsWindow.set(
            channelId,
            useEnvelope
              ? createEnvelopeSeries(timesS, values, start, end, request.pixelWidth)
              : copyPointSeries(timesS, values, start, end),
          )
        }

        const windowAnnotations = annotations.filter((annotation) => {
          const annotationEnd = annotation.startTimeS + annotation.durationS
          return annotation.startTimeS < requestEnd && annotationEnd >= requestStart
        })

        return {
          sourceId: options.sourceId,
          sourceRevision: revision,
          startTimeS: requestStart,
          endTimeS: requestEnd,
          channels: channelsWindow,
          annotations: windowAnnotations,
        }
      })
    },
  }
}
