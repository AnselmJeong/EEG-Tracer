import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'

import { annotationKind } from '../annotations/annotation-layout'
import type { TraceAnnotation, TraceAnnotationKind, TraceMetadata } from '../model/trace-data'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'

const KIND_LABELS = {
  annotation: 'annotation',
  event: 'event',
  'bad-segment': 'bad segment',
} as const satisfies Record<TraceAnnotationKind, string>

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function RecordingOverview({
  annotations,
  announce,
  dispatch,
  left,
  metadata,
  state,
  width,
}: {
  annotations: readonly TraceAnnotation[]
  announce: (message: string) => void
  dispatch: (action: TraceViewerAction) => void
  left: number
  metadata: TraceMetadata
  state: TraceViewerInteractionState
  width: number
}) {
  const recordingEnd = metadata.startTimeS + metadata.durationS
  const viewportStartRatio = (state.viewport.startTimeS - metadata.startTimeS) / metadata.durationS
  const viewportWidthRatio = state.viewport.durationS / metadata.durationS

  const jump = (timeS: number, label: string): void => {
    dispatch({ type: 'jump-to-time', timeS })
    announce(`Jumped to ${label} at ${timeS.toFixed(3)} seconds.`)
  }

  const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.focus()
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = bounds.width <= 0 ? 0 : clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
    jump(metadata.startTimeS + ratio * metadata.durationS, 'recording overview')
  }

  const handleTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      dispatch({
        type: 'pan-time',
        deltaTimeS: state.viewport.durationS * 0.8 * (event.key === 'ArrowLeft' ? -1 : 1),
      })
      announce('Recording overview moved the time viewport.')
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      dispatch({
        type: 'set-time-start',
        startTimeS: event.key === 'Home' ? metadata.startTimeS : recordingEnd - state.viewport.durationS,
      })
      announce(`Moved to recording ${event.key === 'Home' ? 'start' : 'end'}.`)
    }
  }

  return (
    <div
      aria-label="Recording overview"
      className="nsv-overview"
      role="group"
      style={{ left, width }}
    >
      <div
        aria-label={`Recording overview, visible window ${state.viewport.startTimeS.toFixed(2)} to ${(state.viewport.startTimeS + state.viewport.durationS).toFixed(2)} seconds`}
        aria-valuemax={recordingEnd - state.viewport.durationS}
        aria-valuemin={metadata.startTimeS}
        aria-valuenow={state.viewport.startTimeS}
        aria-valuetext={`${state.viewport.startTimeS.toFixed(2)} to ${(state.viewport.startTimeS + state.viewport.durationS).toFixed(2)} seconds`}
        className="nsv-overview-track"
        onKeyDown={handleTrackKeyDown}
        onPointerDown={handleTrackPointerDown}
        role="slider"
        tabIndex={0}
      >
        <span
          aria-hidden="true"
          className="nsv-overview-window"
          style={{ left: `${viewportStartRatio * 100}%`, width: `${viewportWidthRatio * 100}%` }}
        />
      </div>
      {annotations.map((annotation) => {
        const kind = annotationKind(annotation)
        const startRatio = clamp((annotation.startTimeS - metadata.startTimeS) / metadata.durationS, 0, 1)
        const endRatio = clamp((annotation.startTimeS + Math.max(0, annotation.durationS) - metadata.startTimeS) / metadata.durationS, 0, 1)
        const inViewport = annotation.startTimeS >= state.viewport.startTimeS
          && annotation.startTimeS <= state.viewport.startTimeS + state.viewport.durationS
        return (
          <button
            aria-label={`Jump to ${KIND_LABELS[kind]} ${annotation.label} at ${annotation.startTimeS.toFixed(3)} seconds`}
            className={`nsv-overview-marker is-${kind}${inViewport ? ' is-visible' : ''}`}
            data-annotation-id={annotation.id}
            key={annotation.id}
            onClick={() => jump(annotation.startTimeS, annotation.label)}
            style={{
              '--nsv-annotation-color': annotation.color ?? 'var(--nsv-alert)',
              left: `${startRatio * 100}%`,
              width: kind === 'event' ? undefined : `${Math.max(0.25, (endRatio - startRatio) * 100)}%`,
            } as CSSProperties}
            title={`${KIND_LABELS[kind]} · ${annotation.label}`}
            type="button"
          >
            <span className="nsv-sr-only">{KIND_LABELS[kind]}</span>
          </button>
        )
      })}
    </div>
  )
}
