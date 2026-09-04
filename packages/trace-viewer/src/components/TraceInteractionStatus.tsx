import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import type { TraceViewerInteractionState } from '../state/trace-viewer-reducer'

function formatCursorValue(layers: readonly LoadedTraceLayer[], state: TraceViewerInteractionState): string {
  const cursor = state.cursor
  if (cursor === null || cursor.channelId === undefined) return 'Cursor —'
  const channel = layers[0]?.metadata.channels.find(({ id }) => id === cursor.channelId)
  const series = layers[0]?.window.channels.get(cursor.channelId)
  if (channel === undefined || series === undefined) return `${cursor.channelId} · ${cursor.timeS.toFixed(3)} s`
  if (series.representation === 'points') {
    let nearestIndex = -1
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < series.timesS.length; index += 1) {
      const timeS = series.timesS[index]
      if (timeS === undefined) continue
      const distance = Math.abs(timeS - cursor.timeS)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }
    const value = series.values[nearestIndex]
    return Number.isFinite(value)
      ? `${channel.label} · ${cursor.timeS.toFixed(3)} s · ${value?.toFixed(2)} ${channel.unit}`
      : `${channel.label} · ${cursor.timeS.toFixed(3)} s · unavailable`
  }
  return `${channel.label} · ${cursor.timeS.toFixed(3)} s · envelope view`
}

export function TraceInteractionStatus({ helpId, layers, state }: { helpId: string; layers: readonly LoadedTraceLayer[]; state: TraceViewerInteractionState }) {
  const selection = state.selection
  return (
    <div className="nsv-interaction-status">
      <span>{formatCursorValue(layers, state)}</span>
      <span>{selection === null
        ? 'Selection —'
        : `Selection ${selection.startTimeS.toFixed(3)}–${selection.endTimeS.toFixed(3)} s · ${(selection.endTimeS - selection.startTimeS).toFixed(3)} s`}</span>
      <span>{state.selectedChannelIds.length === 0 ? 'No channels selected' : `${state.selectedChannelIds.length} channel${state.selectedChannelIds.length === 1 ? '' : 's'} selected`}</span>
      <small id={helpId}>Arrows navigate · Shift+drag pans · Drag selects · Alt +/− zooms · Enter selects channel</small>
    </div>
  )
}
