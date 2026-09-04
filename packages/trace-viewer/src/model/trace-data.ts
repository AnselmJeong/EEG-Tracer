import type { TraceCapabilities } from './capabilities'
import type { TraceChannel } from './channel'

export type TraceAnnotationKind = 'annotation' | 'event' | 'bad-segment'

export interface TraceAnnotation {
  id: string
  label: string
  startTimeS: number
  durationS: number
  kind?: TraceAnnotationKind
  color?: string
}

export type TraceAnnotationIntent =
  | { type: 'create'; annotation: Omit<TraceAnnotation, 'id'> }
  | { type: 'update'; annotation: TraceAnnotation }
  | { type: 'delete'; annotationId: string }

export interface TraceMetadata {
  sourceId: string
  revision: string
  title?: string
  startTimeS: number
  durationS: number
  samplingRateHz: number
  channels: readonly TraceChannel[]
  annotations: readonly TraceAnnotation[]
  capabilities: TraceCapabilities
}

export type TraceSeries =
  | {
      representation: 'points'
      timesS: Float64Array
      values: Float32Array
    }
  | {
      representation: 'min-max'
      bucketStartTimesS: Float64Array
      minimum: Float32Array
      maximum: Float32Array
    }

export interface TraceWindow {
  sourceId: string
  sourceRevision: string
  startTimeS: number
  endTimeS: number
  channels: ReadonlyMap<string, TraceSeries>
  annotations: readonly TraceAnnotation[]
}

export interface TraceWindowRequest {
  sourceRevision: string
  startTimeS: number
  durationS: number
  channelIds: readonly string[]
  pixelWidth: number
  preferredRepresentation: 'auto' | 'points' | 'min-max'
}

export interface TraceDataSource {
  readonly id: string
  getMetadata(signal?: AbortSignal): Promise<TraceMetadata>
  getWindow(request: TraceWindowRequest, signal?: AbortSignal): Promise<TraceWindow>
}
