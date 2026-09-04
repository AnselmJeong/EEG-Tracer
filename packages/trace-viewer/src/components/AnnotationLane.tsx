import type { CSSProperties } from 'react'

import { annotationKind, layoutAnnotations } from '../annotations/annotation-layout'
import type { TraceAnnotation, TraceAnnotationKind } from '../model/trace-data'
import type { TraceRenderModel } from '../renderers/TraceRenderer'

const KIND_LABELS = {
  annotation: 'ANN',
  event: 'EVENT',
  'bad-segment': 'BAD',
} as const satisfies Record<TraceAnnotationKind, string>
const MAXIMUM_VISIBLE_LANES = 4

function annotationLabel(annotation: TraceAnnotation, clippedBefore: boolean, clippedAfter: boolean): string {
  const kind = annotationKind(annotation)
  const duration = annotation.durationS > 0 ? `, duration ${annotation.durationS.toFixed(3)} seconds` : ''
  const clipping = clippedBefore && clippedAfter
    ? ', continues outside the visible window'
    : clippedBefore
      ? ', continues from before the visible window'
      : clippedAfter
        ? ', continues after the visible window'
        : ''
  return `${KIND_LABELS[kind]}: ${annotation.label}, at ${annotation.startTimeS.toFixed(3)} seconds${duration}${clipping}`
}

export function AnnotationLane({
  annotations,
  interactive,
  model,
  onJump,
}: {
  annotations: readonly TraceAnnotation[]
  interactive: boolean
  model: TraceRenderModel
  onJump: (annotation: TraceAnnotation) => void
}) {
  const positioned = layoutAnnotations(annotations, model.viewport, model.geometry.width)
  if (positioned.length === 0) return null
  const visiblePositioned = positioned.filter(({ lane }) => lane < MAXIMUM_VISIBLE_LANES)
  const hiddenCount = positioned.length - visiblePositioned.length

  return (
    <div
      aria-label="Visible annotations and events"
      className="nsv-annotation-lane"
      role="list"
      style={{
        height: Math.max(20, model.geometry.top - 12),
        left: model.geometry.left,
        width: model.geometry.width,
      }}
    >
      {visiblePositioned.map(({ annotation, clippedAfter, clippedBefore, endRatio, lane, showLabel, startRatio }) => {
        const kind = annotationKind(annotation)
        const width = Math.max(kind === 'event' ? 0 : 0.15, (endRatio - startRatio) * 100)
        const style = {
          '--nsv-annotation-color': annotation.color ?? 'var(--nsv-alert)',
          left: `${startRatio * 100}%`,
          top: lane * 19,
          width: kind === 'event' ? undefined : `${width}%`,
        } as CSSProperties
        const content = (
          <>
            <span aria-hidden="true" className="nsv-annotation-kind">{KIND_LABELS[kind]}</span>
            {showLabel ? <span aria-hidden="true" className="nsv-annotation-label">{annotation.label}</span> : null}
          </>
        )

        return (
          <div className="nsv-annotation-item" key={annotation.id} role="listitem">
            {interactive ? (
              <button
                aria-label={`Jump to ${annotationLabel(annotation, clippedBefore, clippedAfter)}`}
                className={`nsv-annotation-chip is-${kind}`}
                data-annotation-id={annotation.id}
                onClick={() => onJump(annotation)}
                style={style}
                title={annotationLabel(annotation, clippedBefore, clippedAfter)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <span
                aria-label={annotationLabel(annotation, clippedBefore, clippedAfter)}
                className={`nsv-annotation-chip is-${kind}`}
                role="note"
                style={style}
              >
                {content}
              </span>
            )}
          </div>
        )
      })}
      {hiddenCount > 0 ? (
        <span
          aria-label={`${hiddenCount} additional overlapping context items are available in the recording overview and semantic details`}
          className="nsv-annotation-overflow"
          role="status"
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  )
}
