import type { TraceChannelType } from './channel'

export interface TraceViewport {
  startTimeS: number
  durationS: number
  channelOffset: number
  visibleChannelCount: number
  gainByType: Partial<Record<TraceChannelType, number>>
}

export const DEFAULT_TRACE_VIEWPORT = {
  startTimeS: 0,
  durationS: 10,
  channelOffset: 0,
  visibleChannelCount: 20,
  gainByType: {},
} as const satisfies TraceViewport
