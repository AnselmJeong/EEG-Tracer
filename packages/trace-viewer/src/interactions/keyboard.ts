import type { KeyboardEvent } from 'react'

import type { TraceChannelType } from '../model/channel'
import type { TraceViewerConstraints } from '../state/invariants'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === 'INPUT'
    || target.tagName === 'SELECT'
    || target.tagName === 'TEXTAREA'
  )
}

export function keyboardAction(
  event: KeyboardEvent<HTMLElement>,
  state: TraceViewerInteractionState,
  constraints: TraceViewerConstraints,
  visibleChannelTypes: readonly TraceChannelType[],
): TraceViewerAction | null {
  if (event.nativeEvent.isComposing || isEditableTarget(event.target)) return null
  const panStep = state.viewport.durationS * (event.shiftKey ? 1 : 0.1)
  switch (event.key) {
    case 'ArrowLeft':
      return { type: 'pan-time', deltaTimeS: -panStep }
    case 'ArrowRight':
      return { type: 'pan-time', deltaTimeS: panStep }
    case 'ArrowUp':
      return { type: 'move-channel-focus', delta: -1 }
    case 'ArrowDown':
      return { type: 'move-channel-focus', delta: 1 }
    case 'PageUp':
      return { type: 'shift-channel-offset', delta: -state.viewport.visibleChannelCount }
    case 'PageDown':
      return { type: 'shift-channel-offset', delta: state.viewport.visibleChannelCount }
    case '+':
    case '=':
      return event.altKey
        ? { type: 'zoom-time', factor: 0.5 }
        : { type: 'scale-gain', factor: 2, channelTypes: visibleChannelTypes }
    case '-':
    case '_':
      return event.altKey
        ? { type: 'zoom-time', factor: 2 }
        : { type: 'scale-gain', factor: 0.5, channelTypes: visibleChannelTypes }
    case 'Home':
      return { type: 'set-time-start', startTimeS: constraints.startTimeS }
    case 'End':
      return {
        type: 'set-time-start',
        startTimeS: constraints.startTimeS + constraints.durationS - state.viewport.durationS,
      }
    case 'Escape':
      return { type: 'set-selection', selection: null }
    case 'Enter':
      return state.focusedChannelId === null
        ? null
        : { type: 'toggle-channel-selection', channelId: state.focusedChannelId }
    default:
      return null
  }
}
