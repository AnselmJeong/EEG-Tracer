import type { TraceChannelType } from '../model/channel'
import type { TraceCursor, TraceSelection } from '../model/selection'
import type { TraceViewport } from '../model/viewport'
import {
  normalizeChannelIds,
  normalizeCursor,
  normalizeSelection,
  normalizeViewport,
  recordingEndTimeS,
} from './invariants'
import type { TraceViewerConstraints } from './invariants'

export interface TraceViewerInteractionState {
  cursor: TraceCursor | null
  focusedChannelId: string | null
  selectedChannelIds: readonly string[]
  selection: TraceSelection | null
  viewport: TraceViewport
}

export type TraceViewerAction =
  | { type: 'replace'; state: TraceViewerInteractionState }
  | { type: 'pan-time'; deltaTimeS: number }
  | { type: 'set-time-start'; startTimeS: number }
  | { type: 'jump-to-time'; timeS: number; channelId?: string }
  | { type: 'zoom-time'; anchorTimeS?: number; factor: number }
  | { type: 'shift-channel-offset'; delta: number }
  | { type: 'set-visible-channel-count'; count: number }
  | { type: 'scale-gain'; channelTypes?: readonly TraceChannelType[]; factor: number }
  | { type: 'set-cursor'; cursor: TraceCursor | null }
  | { type: 'set-selection'; selection: TraceSelection | null }
  | { type: 'focus-channel'; channelId: string }
  | { type: 'move-channel-focus'; delta: number }
  | { type: 'toggle-channel-selection'; channelId: string }

export function normalizeInteractionState(
  state: TraceViewerInteractionState,
  constraints: TraceViewerConstraints,
): TraceViewerInteractionState {
  const viewport = normalizeViewport(state.viewport, constraints)
  const selectedChannelIds = normalizeChannelIds(state.selectedChannelIds, constraints)
  const focusedChannelId = state.focusedChannelId !== null && constraints.channelIds.includes(state.focusedChannelId)
    ? state.focusedChannelId
    : (constraints.channelIds[viewport.channelOffset] ?? null)
  return {
    viewport,
    cursor: normalizeCursor(state.cursor, constraints),
    selection: normalizeSelection(state.selection, constraints),
    selectedChannelIds,
    focusedChannelId,
  }
}

function viewportWithFocusedChannel(
  viewport: TraceViewport,
  channelIndex: number,
  constraints: TraceViewerConstraints,
): TraceViewport {
  let channelOffset = viewport.channelOffset
  if (channelIndex < channelOffset) channelOffset = channelIndex
  if (channelIndex >= channelOffset + viewport.visibleChannelCount) {
    channelOffset = channelIndex - viewport.visibleChannelCount + 1
  }
  return normalizeViewport({ ...viewport, channelOffset }, constraints)
}

export function reduceTraceViewerState(
  current: TraceViewerInteractionState,
  action: TraceViewerAction,
  constraints: TraceViewerConstraints,
): TraceViewerInteractionState {
  const state = normalizeInteractionState(current, constraints)
  switch (action.type) {
    case 'replace':
      return normalizeInteractionState(action.state, constraints)
    case 'pan-time':
      return {
        ...state,
        viewport: normalizeViewport({
          ...state.viewport,
          startTimeS: state.viewport.startTimeS + action.deltaTimeS,
        }, constraints),
      }
    case 'set-time-start':
      return {
        ...state,
        viewport: normalizeViewport({ ...state.viewport, startTimeS: action.startTimeS }, constraints),
      }
    case 'jump-to-time':
      return {
        ...state,
        cursor: normalizeCursor({
          timeS: action.timeS,
          ...(action.channelId === undefined ? {} : { channelId: action.channelId }),
        }, constraints),
        viewport: normalizeViewport({
          ...state.viewport,
          startTimeS: action.timeS - state.viewport.durationS / 2,
        }, constraints),
      }
    case 'zoom-time': {
      const factor = Number.isFinite(action.factor) && action.factor > 0 ? action.factor : 1
      const anchorTimeS = action.anchorTimeS ?? state.viewport.startTimeS + state.viewport.durationS / 2
      const anchorRatio = (anchorTimeS - state.viewport.startTimeS) / state.viewport.durationS
      const durationS = state.viewport.durationS * factor
      return {
        ...state,
        viewport: normalizeViewport({
          ...state.viewport,
          durationS,
          startTimeS: anchorTimeS - durationS * anchorRatio,
        }, constraints),
      }
    }
    case 'shift-channel-offset':
      return {
        ...state,
        viewport: normalizeViewport({
          ...state.viewport,
          channelOffset: state.viewport.channelOffset + action.delta,
        }, constraints),
      }
    case 'set-visible-channel-count':
      return {
        ...state,
        viewport: normalizeViewport({ ...state.viewport, visibleChannelCount: action.count }, constraints),
      }
    case 'scale-gain': {
      const types = action.channelTypes ?? constraints.channelTypes
      const gainByType = { ...state.viewport.gainByType }
      for (const type of types) gainByType[type] = (gainByType[type] ?? 1) * action.factor
      return {
        ...state,
        viewport: normalizeViewport({ ...state.viewport, gainByType }, constraints),
      }
    }
    case 'set-cursor':
      return { ...state, cursor: normalizeCursor(action.cursor, constraints) }
    case 'set-selection':
      return { ...state, selection: normalizeSelection(action.selection, constraints) }
    case 'focus-channel': {
      const index = constraints.channelIds.indexOf(action.channelId)
      if (index < 0) return state
      return {
        ...state,
        focusedChannelId: action.channelId,
        viewport: viewportWithFocusedChannel(state.viewport, index, constraints),
      }
    }
    case 'move-channel-focus': {
      const currentIndex = Math.max(0, constraints.channelIds.indexOf(state.focusedChannelId ?? ''))
      const nextIndex = Math.min(
        constraints.channelIds.length - 1,
        Math.max(0, currentIndex + action.delta),
      )
      const focusedChannelId = constraints.channelIds[nextIndex] ?? null
      return {
        ...state,
        focusedChannelId,
        viewport: viewportWithFocusedChannel(state.viewport, nextIndex, constraints),
      }
    }
    case 'toggle-channel-selection': {
      if (!constraints.channelIds.includes(action.channelId)) return state
      const selected = new Set(state.selectedChannelIds)
      if (selected.has(action.channelId)) selected.delete(action.channelId)
      else selected.add(action.channelId)
      return {
        ...state,
        focusedChannelId: action.channelId,
        selectedChannelIds: constraints.channelIds.filter((id) => selected.has(id)),
      }
    }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

export function createInitialTraceViewerState(
  viewport: TraceViewport,
  constraints: TraceViewerConstraints,
  cursor: TraceCursor | null = null,
  selection: TraceSelection | null = null,
  selectedChannelIds: readonly string[] = [],
): TraceViewerInteractionState {
  const normalizedViewport = normalizeViewport(viewport, constraints)
  return normalizeInteractionState({
    viewport: normalizedViewport,
    cursor,
    selection,
    selectedChannelIds,
    focusedChannelId: constraints.channelIds[normalizedViewport.channelOffset] ?? null,
  }, constraints)
}

export function viewportEndStart(viewport: TraceViewport, constraints: TraceViewerConstraints): number {
  return recordingEndTimeS(constraints) - viewport.durationS
}
