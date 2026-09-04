export interface TraceCursor {
  timeS: number
  channelId?: string
}

export interface TraceSelection {
  startTimeS: number
  endTimeS: number
  channelIds?: readonly string[]
}
