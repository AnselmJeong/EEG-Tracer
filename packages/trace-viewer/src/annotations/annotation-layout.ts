import type { TraceAnnotation, TraceAnnotationKind } from '../model/trace-data'
import type { TraceViewport } from '../model/viewport'

export interface PositionedTraceAnnotation {
  annotation: TraceAnnotation
  clippedAfter: boolean
  clippedBefore: boolean
  endRatio: number
  lane: number
  showLabel: boolean
  startRatio: number
}

export const TRACE_ANNOTATION_KINDS = ['annotation', 'event', 'bad-segment'] as const satisfies readonly TraceAnnotationKind[]

const MINIMUM_LABEL_WIDTH_PX = 64
const EVENT_HIT_WIDTH_PX = 12

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function annotationKind(annotation: TraceAnnotation): TraceAnnotationKind {
  return annotation.kind ?? 'annotation'
}

export function visibleAnnotations(
  annotations: readonly TraceAnnotation[],
  visibleKinds: Readonly<Record<TraceAnnotationKind, boolean>>,
): readonly TraceAnnotation[] {
  return annotations.filter((annotation) => visibleKinds[annotationKind(annotation)])
}

export function layoutAnnotations(
  annotations: readonly TraceAnnotation[],
  viewport: TraceViewport,
  pixelWidth: number,
): readonly PositionedTraceAnnotation[] {
  const viewportEnd = viewport.startTimeS + viewport.durationS
  const eventDuration = viewport.durationS * (EVENT_HIT_WIDTH_PX / Math.max(1, pixelWidth))
  const candidates = annotations
    .filter((annotation) => {
      const end = annotation.startTimeS + Math.max(0, annotation.durationS)
      return annotation.startTimeS <= viewportEnd && end >= viewport.startTimeS
    })
    .map((annotation) => {
      const isEvent = annotationKind(annotation) === 'event'
      const layoutEnd = annotation.startTimeS + (isEvent ? eventDuration : Math.max(0, annotation.durationS))
      return { annotation, layoutEnd }
    })
    .sort((left, right) => (
      left.annotation.startTimeS - right.annotation.startTimeS
      || right.layoutEnd - left.layoutEnd
      || left.annotation.id.localeCompare(right.annotation.id)
    ))

  const laneEnds: number[] = []
  return candidates.map(({ annotation, layoutEnd }) => {
    const availableLane = laneEnds.findIndex((end) => end <= annotation.startTimeS)
    const lane = availableLane < 0 ? laneEnds.length : availableLane
    if (lane === laneEnds.length) laneEnds.push(layoutEnd)
    else laneEnds[lane] = layoutEnd

    const rawEnd = annotation.startTimeS + Math.max(0, annotation.durationS)
    const clippedStart = clamp(annotation.startTimeS, viewport.startTimeS, viewportEnd)
    const clippedEnd = clamp(Math.max(annotation.startTimeS, rawEnd), viewport.startTimeS, viewportEnd)
    const startRatio = (clippedStart - viewport.startTimeS) / viewport.durationS
    const endRatio = annotationKind(annotation) === 'event'
      ? startRatio
      : (clippedEnd - viewport.startTimeS) / viewport.durationS
    const widthPx = Math.max(1, (endRatio - startRatio) * Math.max(1, pixelWidth))

    return {
      annotation,
      clippedAfter: rawEnd > viewportEnd,
      clippedBefore: annotation.startTimeS < viewport.startTimeS,
      endRatio,
      lane,
      showLabel: annotationKind(annotation) !== 'event' && widthPx >= MINIMUM_LABEL_WIDTH_PX,
      startRatio,
    }
  })
}

export function adjacentAnnotation(
  annotations: readonly TraceAnnotation[],
  timeS: number,
  direction: 'next' | 'previous',
): TraceAnnotation | undefined {
  const ordered = [...annotations].sort((left, right) => (
    left.startTimeS - right.startTimeS || left.id.localeCompare(right.id)
  ))
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(timeS))
  if (direction === 'next') return ordered.find((annotation) => annotation.startTimeS > timeS + epsilon) ?? ordered[0]
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const annotation = ordered[index]
    if (annotation !== undefined && annotation.startTimeS < timeS - epsilon) return annotation
  }
  return ordered[ordered.length - 1]
}
