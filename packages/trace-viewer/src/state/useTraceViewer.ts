import { useCallback, useMemo, useReducer } from 'react'

import type { TraceMetadata } from '../model/trace-data'
import type { TraceViewerProps } from '../model/viewer'
import type { TraceViewport } from '../model/viewport'
import {
  channelIdsEqual,
  constraintsFromMetadata,
  cursorEquals,
  normalizeViewport,
  selectionEquals,
  viewportEquals,
} from './invariants'
import {
  createInitialTraceViewerState,
  normalizeInteractionState,
  reduceTraceViewerState,
} from './trace-viewer-reducer'
import type { TraceViewerAction, TraceViewerInteractionState } from './trace-viewer-reducer'

export interface TraceViewerController {
  dispatch: (action: TraceViewerAction) => void
  state: TraceViewerInteractionState
}

function initialViewport(metadata: TraceMetadata, defaults: Partial<TraceViewport> | undefined): TraceViewport {
  return normalizeViewport({
    startTimeS: defaults?.startTimeS ?? metadata.startTimeS,
    durationS: defaults?.durationS ?? metadata.durationS,
    channelOffset: defaults?.channelOffset ?? 0,
    visibleChannelCount: defaults?.visibleChannelCount ?? metadata.channels.length,
    gainByType: defaults?.gainByType ?? {},
  }, constraintsFromMetadata(metadata))
}

type ControlledInteractionProps = Pick<TraceViewerProps,
  | 'cursor'
  | 'defaultCursor'
  | 'defaultSelectedChannelIds'
  | 'defaultSelection'
  | 'defaultViewport'
  | 'onCursorChange'
  | 'onSelectedChannelIdsChange'
  | 'onSelectionChange'
  | 'onViewportChange'
  | 'selectedChannelIds'
  | 'selection'
  | 'viewport'
>

export function useTraceViewer(
  metadata: TraceMetadata,
  props: ControlledInteractionProps,
): TraceViewerController {
  const constraints = useMemo(() => constraintsFromMetadata(metadata), [metadata])
  const [internalState, internalDispatch] = useReducer(
    (state: TraceViewerInteractionState, action: TraceViewerAction) => reduceTraceViewerState(state, action, constraints),
    undefined,
    () => createInitialTraceViewerState(
      props.viewport ?? initialViewport(metadata, props.defaultViewport),
      constraints,
      props.cursor ?? props.defaultCursor ?? null,
      props.selection ?? props.defaultSelection ?? null,
      props.selectedChannelIds ?? props.defaultSelectedChannelIds ?? [],
    ),
  )

  const state = useMemo(() => normalizeInteractionState({
    ...internalState,
    viewport: props.viewport ?? internalState.viewport,
    cursor: props.cursor !== undefined ? props.cursor : internalState.cursor,
    selection: props.selection !== undefined ? props.selection : internalState.selection,
    selectedChannelIds: props.selectedChannelIds ?? internalState.selectedChannelIds,
  }, constraints), [constraints, internalState, props.cursor, props.selectedChannelIds, props.selection, props.viewport])

  const dispatch = useCallback((action: TraceViewerAction): void => {
    const next = reduceTraceViewerState(state, action, constraints)
    internalDispatch({ type: 'replace', state: next })
    if (!viewportEquals(state.viewport, next.viewport)) props.onViewportChange?.(next.viewport)
    if (!cursorEquals(state.cursor, next.cursor)) props.onCursorChange?.(next.cursor)
    if (!selectionEquals(state.selection, next.selection)) props.onSelectionChange?.(next.selection)
    if (!channelIdsEqual(state.selectedChannelIds, next.selectedChannelIds)) {
      props.onSelectedChannelIdsChange?.(next.selectedChannelIds)
    }
  }, [constraints, props, state])

  return { dispatch, state }
}
