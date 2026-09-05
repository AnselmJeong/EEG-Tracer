import type { CSSProperties } from 'react'

import { annotationKind, TRACE_ANNOTATION_KINDS } from '../annotations/annotation-layout'
import type { TraceChannelType } from '../model/channel'
import type { TraceAnnotationKind, TraceMetadata } from '../model/trace-data'
import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import { forEachFiniteValue, formatScale, niceAmplitude } from '../renderers/TraceRenderer'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'

function scaleLabels(layers: readonly LoadedTraceLayer[], state: TraceViewerInteractionState): readonly string[] {
  const maximumByTypeAndUnit = new Map<string, { maximum: number; type: TraceChannelType; unit: string }>()
  const metadata = layers[0]?.metadata
  if (metadata === undefined) return []
  const maximumByUnit = new Map<string, number>()
  for (const channel of metadata.channels.slice(state.viewport.channelOffset, state.viewport.channelOffset + state.viewport.visibleChannelCount)) {
    const key = `${channel.type}\u0000${channel.unit}`
    const entry = maximumByTypeAndUnit.get(key) ?? { maximum: 0, type: channel.type, unit: channel.unit }
    for (const loaded of layers) {
      const series = loaded.window.channels.get(channel.id)
      if (series !== undefined) forEachFiniteValue(series, (value) => { entry.maximum = Math.max(entry.maximum, Math.abs(value)) })
    }
    maximumByTypeAndUnit.set(key, entry)
    maximumByUnit.set(channel.unit, Math.max(maximumByUnit.get(channel.unit) ?? 0, entry.maximum))
  }
  return [...maximumByTypeAndUnit].map(([, { type, unit }]) => {
    const gain = state.viewport.gainByType[type] ?? 1
    return `${type.toUpperCase()} ±${formatScale(niceAmplitude(maximumByUnit.get(unit) ?? 0) / gain)} ${unit} · ${gain}×`
  })
}

interface TraceToolbarProps {
  dispatch: (action: TraceViewerAction) => void
  interactive: boolean
  intentEnabled: boolean
  layers: readonly LoadedTraceLayer[]
  metadata: TraceMetadata
  onJumpAnnotation: (direction: 'next' | 'previous') => void
  onToggleAnnotationKind: (kind: TraceAnnotationKind) => void
  state: TraceViewerInteractionState
  visibleAnnotationKinds: Readonly<Record<TraceAnnotationKind, boolean>>
}

const ANNOTATION_KIND_LABELS = {
  annotation: 'ANN',
  event: 'EVENT',
  'bad-segment': 'BAD',
} as const satisfies Record<TraceAnnotationKind, string>

function ControlButton({ label, onClick, children, disabled = false }: {
  children: string
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return <button aria-label={label} disabled={disabled} onClick={onClick} type="button">{children}</button>
}

export function TraceToolbar({
  dispatch,
  interactive,
  intentEnabled,
  layers,
  metadata,
  onJumpAnnotation,
  onToggleAnnotationKind,
  state,
  visibleAnnotationKinds,
}: TraceToolbarProps) {
  const scales = scaleLabels(layers, state)
  const { viewport } = state
  const recordingEnd = metadata.startTimeS + metadata.durationS
  const maximumStart = recordingEnd - viewport.durationS
  const atStart = viewport.startTimeS <= metadata.startTimeS
  const atEnd = viewport.startTimeS >= maximumStart
  const canShowFewer = viewport.visibleChannelCount > 1
  const canShowMore = viewport.visibleChannelCount < metadata.channels.length
  const visibleAnnotationCount = metadata.annotations.filter((annotation) => visibleAnnotationKinds[annotationKind(annotation)]).length
  return (
    <div className="nsv-toolbar">
      <div className="nsv-toolbar-summary">
        <div className="nsv-toolbar-title">
          <span>EEG TRACE VIEWER</span>
          <strong>{metadata.title ?? metadata.sourceId}</strong>
        </div>
        <div aria-label="Visible trace layers" className="nsv-layer-key">
          {layers.map(({ layer }, index) => (
            <span key={layer.id}>
              <i
                aria-hidden="true"
                className={`is-${layer.lineStyle ?? 'solid'}`}
                style={{ '--nsv-key-color': layer.color ?? (index === 0 ? '#286d6d' : '#ba6547') } as CSSProperties}
              />
              {layer.label}
            </span>
          ))}
        </div>
        <div className="nsv-scale-readout">
          <span>{layers.length > 1 ? 'LOCKED SCALE' : 'VISIBLE RANGE'}</span>
          <strong>{scales.join(' · ') || 'No finite values'}</strong>
          <small>{intentEnabled ? 'EDITABLE' : 'READ ONLY'}</small>
        </div>
      </div>
      {interactive ? (
        <div className="nsv-toolbar-controls">
          <div aria-label="Time navigation" className="nsv-control-group nsv-time-controls" role="group">
            <span>TIME</span>
            <ControlButton disabled={atStart} label="Go to recording start" onClick={() => dispatch({ type: 'set-time-start', startTimeS: metadata.startTimeS })}>|‹</ControlButton>
            <ControlButton disabled={atStart} label="Pan backward" onClick={() => dispatch({ type: 'pan-time', deltaTimeS: -viewport.durationS * 0.8 })}>‹</ControlButton>
            <input
              aria-label="Time position"
              disabled={maximumStart <= metadata.startTimeS}
              max={maximumStart}
              min={metadata.startTimeS}
              onChange={(event) => dispatch({ type: 'set-time-start', startTimeS: event.currentTarget.valueAsNumber })}
              step={1 / metadata.samplingRateHz}
              type="range"
              value={viewport.startTimeS}
            />
            <output>{viewport.startTimeS.toFixed(2)}–{(viewport.startTimeS + viewport.durationS).toFixed(2)} s</output>
            <ControlButton disabled={atEnd} label="Pan forward" onClick={() => dispatch({ type: 'pan-time', deltaTimeS: viewport.durationS * 0.8 })}>›</ControlButton>
            <ControlButton disabled={atEnd} label="Go to recording end" onClick={() => dispatch({ type: 'set-time-start', startTimeS: maximumStart })}>›|</ControlButton>
          </div>
          <div aria-label="Time zoom" className="nsv-control-group" role="group">
            <span>ZOOM</span>
            <ControlButton label="Zoom out in time" onClick={() => dispatch({ type: 'zoom-time', factor: 2 })}>−</ControlButton>
            <output>{viewport.durationS.toFixed(viewport.durationS < 10 ? 2 : 1)} s</output>
            <ControlButton label="Zoom in in time" onClick={() => dispatch({ type: 'zoom-time', factor: 0.5 })}>+</ControlButton>
          </div>
          <div aria-label="Context overlays" className="nsv-control-group nsv-context-controls" role="group">
            <span>CONTEXT</span>
            <ControlButton
              disabled={visibleAnnotationCount === 0}
              label="Jump to previous visible annotation or event"
              onClick={() => onJumpAnnotation('previous')}
            >‹</ControlButton>
            <ControlButton
              disabled={visibleAnnotationCount === 0}
              label="Jump to next visible annotation or event"
              onClick={() => onJumpAnnotation('next')}
            >›</ControlButton>
            {TRACE_ANNOTATION_KINDS.map((kind) => (
              <button
                aria-label={`Show ${kind} overlays`}
                aria-pressed={visibleAnnotationKinds[kind]}
                className={`nsv-kind-toggle is-${kind}`}
                key={kind}
                onClick={() => onToggleAnnotationKind(kind)}
                type="button"
              >
                {ANNOTATION_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <div aria-label="Amplitude gain" className="nsv-control-group" role="group">
            <span>GAIN</span>
            <ControlButton label="Decrease amplitude gain" onClick={() => dispatch({ type: 'scale-gain', factor: 0.5 })}>−</ControlButton>
            <ControlButton label="Increase amplitude gain" onClick={() => dispatch({ type: 'scale-gain', factor: 2 })}>+</ControlButton>
          </div>
          <div aria-label="Channel viewport" className="nsv-control-group" role="group">
            <span>CHANNELS</span>
            <ControlButton disabled={viewport.channelOffset === 0} label="Previous channel page" onClick={() => dispatch({ type: 'shift-channel-offset', delta: -viewport.visibleChannelCount })}>↑</ControlButton>
            <output>{viewport.channelOffset + 1}–{Math.min(metadata.channels.length, viewport.channelOffset + viewport.visibleChannelCount)} / {metadata.channels.length}</output>
            <ControlButton disabled={viewport.channelOffset + viewport.visibleChannelCount >= metadata.channels.length} label="Next channel page" onClick={() => dispatch({ type: 'shift-channel-offset', delta: viewport.visibleChannelCount })}>↓</ControlButton>
            <ControlButton disabled={!canShowFewer} label="Show fewer channels" onClick={() => dispatch({ type: 'set-visible-channel-count', count: viewport.visibleChannelCount - 1 })}>−</ControlButton>
            <ControlButton disabled={!canShowMore} label="Show more channels" onClick={() => dispatch({ type: 'set-visible-channel-count', count: viewport.visibleChannelCount + 1 })}>+</ControlButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
