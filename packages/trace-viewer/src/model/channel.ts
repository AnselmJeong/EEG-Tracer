export const TRACE_CHANNEL_TYPES = [
  'eeg',
  'eog',
  'ecg',
  'emg',
  'stim',
  'misc',
  'source',
  'unknown',
] as const

export type TraceChannelType = (typeof TRACE_CHANNEL_TYPES)[number]

export interface TraceChannelPosition {
  x: number
  y: number
  z?: number
  coordinateFrame?: string
}

export interface TraceChannel {
  id: string
  label: string
  type: TraceChannelType
  unit: string
  bad: boolean
  position?: TraceChannelPosition
}
