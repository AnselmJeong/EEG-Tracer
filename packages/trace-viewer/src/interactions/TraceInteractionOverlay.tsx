import { useRef } from 'react'
import type { CSSProperties, PointerEvent, WheelEvent } from 'react'

import type { TraceCursor, TraceSelection } from '../model/selection'
import type { TraceRenderModel } from '../renderers/TraceRenderer'
import type { TraceViewerConstraints } from '../state/invariants'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'
import { keyboardAction } from './keyboard'

interface TraceInteractionOverlayProps {
  announce: (message: string) => void
  constraints: TraceViewerConstraints
  describedById: string
  dispatch: (action: TraceViewerAction) => void
  model: TraceRenderModel
  state: TraceViewerInteractionState
}

interface PointerGesture {
  bounds: DOMRect
  pointerId: number
  startClientX: number
  type: 'pan' | 'select'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function timeAtClientX(clientX: number, bounds: DOMRect, model: TraceRenderModel): number {
  const ratio = bounds.width <= 0 ? 0 : clamp((clientX - bounds.left) / bounds.width, 0, 1)
  return model.viewport.startTimeS + ratio * model.viewport.durationS
}

function channelAtClientY(clientY: number, bounds: DOMRect, model: TraceRenderModel): string | undefined {
  if (bounds.height <= 0) return undefined
  const index = clamp(Math.floor(((clientY - bounds.top) / bounds.height) * model.channels.length), 0, model.channels.length - 1)
  return model.channels[index]?.id
}

function selectionStyle(selection: TraceSelection | null, model: TraceRenderModel): CSSProperties {
  if (selection === null) return { display: 'none' }
  const start = clamp((selection.startTimeS - model.viewport.startTimeS) / model.viewport.durationS, 0, 1)
  const end = clamp((selection.endTimeS - model.viewport.startTimeS) / model.viewport.durationS, 0, 1)
  if (end <= start) return { display: 'none' }
  return { left: `${start * 100}%`, width: `${(end - start) * 100}%` }
}

function cursorStyle(cursor: TraceCursor | null, model: TraceRenderModel): CSSProperties {
  if (cursor === null) return { display: 'none' }
  const ratio = (cursor.timeS - model.viewport.startTimeS) / model.viewport.durationS
  if (ratio < 0 || ratio > 1) return { display: 'none' }
  return { left: `${ratio * 100}%` }
}

export function TraceInteractionOverlay({ announce, constraints, describedById, dispatch, model, state }: TraceInteractionOverlayProps) {
  const gestureRef = useRef<PointerGesture | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<HTMLDivElement>(null)
  const visibleChannelTypes = model.channels.map(({ type }) => type).filter((type, index, values) => values.indexOf(type) === index)

  const updatePreview = (clientX: number): void => {
    const gesture = gestureRef.current
    const preview = previewRef.current
    if (gesture === null || preview === null || gesture.type !== 'select') return
    const start = clamp(gesture.startClientX - gesture.bounds.left, 0, gesture.bounds.width)
    const end = clamp(clientX - gesture.bounds.left, 0, gesture.bounds.width)
    preview.hidden = false
    preview.style.left = `${Math.min(start, end)}px`
    preview.style.width = `${Math.abs(end - start)}px`
  }

  const clearPreview = (): void => {
    if (previewRef.current !== null) previewRef.current.hidden = true
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    gestureRef.current = {
      bounds,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      type: event.shiftKey ? 'pan' : 'select',
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (!event.shiftKey) updatePreview(event.clientX)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const bounds = gestureRef.current?.bounds ?? event.currentTarget.getBoundingClientRect()
    const hover = hoverRef.current
    if (hover !== null && bounds.width > 0) {
      hover.hidden = false
      hover.style.left = `${clamp(event.clientX - bounds.left, 0, bounds.width)}px`
    }
    updatePreview(event.clientX)
  }

  const finishGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current
    if (gesture === null || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    clearPreview()
    if (gesture.type === 'pan') {
      const pixels = event.clientX - gesture.startClientX
      const deltaTimeS = gesture.bounds.width <= 0 ? 0 : -(pixels / gesture.bounds.width) * model.viewport.durationS
      dispatch({ type: 'pan-time', deltaTimeS })
      announce('Time viewport moved.')
      return
    }

    const startTimeS = timeAtClientX(gesture.startClientX, gesture.bounds, model)
    const endTimeS = timeAtClientX(event.clientX, gesture.bounds, model)
    const threshold = 0.5 / Math.max(Number.EPSILON, constraints.samplingRateHz)
    if (Math.abs(endTimeS - startTimeS) <= threshold) {
      const channelId = channelAtClientY(event.clientY, gesture.bounds, model)
      dispatch({
        type: 'set-cursor',
        cursor: { timeS: endTimeS, ...(channelId === undefined ? {} : { channelId }) },
      })
      announce(`Cursor set at ${endTimeS.toFixed(3)} seconds${channelId === undefined ? '' : ` on ${channelId}`}.`)
    } else {
      dispatch({ type: 'set-selection', selection: { startTimeS, endTimeS } })
      announce(`Selected ${Math.abs(endTimeS - startTimeS).toFixed(3)} seconds.`)
    }
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>): void => {
    if (event.altKey) {
      const bounds = event.currentTarget.getBoundingClientRect()
      dispatch({
        type: 'zoom-time',
        factor: Math.exp(event.deltaY * 0.002),
        anchorTimeS: timeAtClientX(event.clientX, bounds, model),
      })
    } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const delta = event.shiftKey ? event.deltaY : event.deltaX
      dispatch({ type: 'pan-time', deltaTimeS: (delta / Math.max(1, event.currentTarget.clientWidth)) * model.viewport.durationS })
    } else {
      dispatch({ type: 'shift-channel-offset', delta: Math.sign(event.deltaY) })
    }
    event.preventDefault()
  }

  return (
    <div
      aria-describedby={describedById}
      aria-label="Interactive trace viewport"
      className="nsv-interaction-overlay"
      data-testid="trace-interaction-surface"
      onKeyDown={(event) => {
        const action = keyboardAction(event, state, constraints, visibleChannelTypes)
        if (action === null) return
        event.preventDefault()
        dispatch(action)
        announce('Trace viewport updated.')
      }}
      onPointerCancel={() => {
        gestureRef.current = null
        clearPreview()
      }}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        if (gestureRef.current === null && hoverRef.current !== null) hoverRef.current.hidden = true
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onWheel={handleWheel}
      role="application"
      style={{
        height: model.geometry.height,
        left: model.geometry.left,
        top: model.geometry.top,
        width: model.geometry.width,
      }}
      tabIndex={0}
    >
      {model.channels.map((channel, index) => (
        <span
          aria-hidden="true"
          className={`nsv-channel-highlight${state.selectedChannelIds.includes(channel.id) ? ' is-selected' : ''}${state.focusedChannelId === channel.id ? ' is-focused' : ''}`}
          key={channel.id}
          style={{ height: `${100 / model.channels.length}%`, top: `${(index * 100) / model.channels.length}%` }}
        />
      ))}
      <div aria-hidden="true" className="nsv-selection" style={selectionStyle(state.selection, model)} />
      <div aria-hidden="true" className="nsv-selection nsv-selection-preview" hidden ref={previewRef} />
      <div aria-hidden="true" className="nsv-cursor" style={cursorStyle(state.cursor, model)} />
      <div aria-hidden="true" className="nsv-hover-cursor" hidden ref={hoverRef} />
    </div>
  )
}
