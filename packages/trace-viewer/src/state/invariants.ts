import { TRACE_CHANNEL_TYPES } from '../model/channel'
import type { TraceChannel, TraceChannelType } from '../model/channel'
import type { TraceCursor, TraceSelection } from '../model/selection'
import type { TraceMetadata } from '../model/trace-data'
import type { TraceViewport } from '../model/viewport'

export const MINIMUM_GAIN = 0.125
export const MAXIMUM_GAIN = 16

export interface TraceViewerConstraints {
  channelIds: readonly string[]
  channelTypes: readonly TraceChannelType[]
  durationS: number
  samplingRateHz: number
  startTimeS: number
}

export function constraintsFromMetadata(metadata: TraceMetadata): TraceViewerConstraints {
  return {
    channelIds: metadata.channels.map(({ id }) => id),
    channelTypes: uniqueChannelTypes(metadata.channels),
    durationS: metadata.durationS,
    samplingRateHz: metadata.samplingRateHz,
    startTimeS: metadata.startTimeS,
  }
}

function uniqueChannelTypes(channels: readonly TraceChannel[]): readonly TraceChannelType[] {
  const types = new Set(channels.map(({ type }) => type))
  return TRACE_CHANNEL_TYPES.filter((type) => types.has(type))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function recordingEndTimeS(constraints: TraceViewerConstraints): number {
  return constraints.startTimeS + constraints.durationS
}

export function snapTimeToSample(timeS: number, constraints: TraceViewerConstraints): number {
  const rate = Math.max(Number.EPSILON, constraints.samplingRateHz)
  const relativeSamples = Math.round((finiteOr(timeS, constraints.startTimeS) - constraints.startTimeS) * rate)
  return clamp(
    constraints.startTimeS + relativeSamples / rate,
    constraints.startTimeS,
    recordingEndTimeS(constraints),
  )
}

export function normalizeViewport(
  viewport: TraceViewport,
  constraints: TraceViewerConstraints,
): TraceViewport {
  const minimumDuration = Math.min(constraints.durationS, 1 / Math.max(Number.EPSILON, constraints.samplingRateHz))
  const durationS = clamp(
    finiteOr(viewport.durationS, constraints.durationS),
    minimumDuration,
    constraints.durationS,
  )
  const maximumStart = recordingEndTimeS(constraints) - durationS
  const startTimeS = clamp(
    finiteOr(viewport.startTimeS, constraints.startTimeS),
    constraints.startTimeS,
    maximumStart,
  )
  const maximumChannelCount = Math.max(1, constraints.channelIds.length)
  const visibleChannelCount = clamp(
    Math.floor(finiteOr(viewport.visibleChannelCount, maximumChannelCount)),
    1,
    maximumChannelCount,
  )
  const channelOffset = clamp(
    Math.floor(finiteOr(viewport.channelOffset, 0)),
    0,
    Math.max(0, constraints.channelIds.length - visibleChannelCount),
  )
  const gainByType: Partial<Record<TraceChannelType, number>> = {}
  for (const type of TRACE_CHANNEL_TYPES) {
    const gain = viewport.gainByType[type]
    if (gain !== undefined) gainByType[type] = clamp(finiteOr(gain, 1), MINIMUM_GAIN, MAXIMUM_GAIN)
  }

  return { startTimeS, durationS, channelOffset, visibleChannelCount, gainByType }
}

export function normalizeCursor(
  cursor: TraceCursor | null,
  constraints: TraceViewerConstraints,
): TraceCursor | null {
  if (cursor === null) return null
  const channelId = cursor.channelId !== undefined && constraints.channelIds.includes(cursor.channelId)
    ? cursor.channelId
    : undefined
  return {
    timeS: snapTimeToSample(cursor.timeS, constraints),
    ...(channelId === undefined ? {} : { channelId }),
  }
}

export function normalizeSelection(
  selection: TraceSelection | null,
  constraints: TraceViewerConstraints,
): TraceSelection | null {
  if (selection === null) return null
  const startTimeS = snapTimeToSample(Math.min(selection.startTimeS, selection.endTimeS), constraints)
  const endTimeS = snapTimeToSample(Math.max(selection.startTimeS, selection.endTimeS), constraints)
  if (!(startTimeS < endTimeS)) return null
  const channelIds = selection.channelIds?.filter((id, index, values) => (
    constraints.channelIds.includes(id) && values.indexOf(id) === index
  ))
  return {
    startTimeS,
    endTimeS,
    ...(channelIds === undefined || channelIds.length === 0 ? {} : { channelIds }),
  }
}

export function normalizeChannelIds(
  channelIds: readonly string[],
  constraints: TraceViewerConstraints,
): readonly string[] {
  const selected = new Set(channelIds)
  return constraints.channelIds.filter((id) => selected.has(id))
}

export function viewportEquals(left: TraceViewport, right: TraceViewport): boolean {
  if (left.startTimeS !== right.startTimeS
    || left.durationS !== right.durationS
    || left.channelOffset !== right.channelOffset
    || left.visibleChannelCount !== right.visibleChannelCount) return false
  return TRACE_CHANNEL_TYPES.every((type) => left.gainByType[type] === right.gainByType[type])
}

export function cursorEquals(left: TraceCursor | null, right: TraceCursor | null): boolean {
  return left?.timeS === right?.timeS && left?.channelId === right?.channelId
}

export function selectionEquals(left: TraceSelection | null, right: TraceSelection | null): boolean {
  if (left?.startTimeS !== right?.startTimeS || left?.endTimeS !== right?.endTimeS) return false
  const leftIds = left?.channelIds ?? []
  const rightIds = right?.channelIds ?? []
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index])
}

export function channelIdsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
