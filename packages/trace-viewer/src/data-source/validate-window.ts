import type { TraceWindow, TraceWindowRequest } from '../model/trace-data'

export function validateTraceWindow(sourceId: string, request: TraceWindowRequest, window: TraceWindow): void {
  if (window.sourceId !== sourceId || window.sourceRevision !== request.sourceRevision) {
    throw new Error(`Trace source ${sourceId} returned a stale or mismatched window.`)
  }
  if (!Number.isFinite(window.startTimeS) || !Number.isFinite(window.endTimeS)
    || window.startTimeS >= window.endTimeS
    || window.startTimeS < request.startTimeS - 1e-8
    || window.endTimeS > request.startTimeS + request.durationS + 1e-8) {
    throw new Error('Trace source returned an invalid time window.')
  }
  if (window.channels.size !== request.channelIds.length) throw new Error('Trace source returned unexpected channels.')
  for (const id of request.channelIds) {
    const series = window.channels.get(id)
    if (series === undefined) throw new Error(`Trace source omitted channel ${id}.`)
    const times = series.representation === 'points' ? series.timesS : series.bucketStartTimesS
    const values = series.representation === 'points' ? [series.values] : [series.minimum, series.maximum]
    if (!(times instanceof Float64Array) || values.some((array) => !(array instanceof Float32Array) || array.length !== times.length)) {
      throw new Error(`Trace channel ${id} has invalid typed arrays.`)
    }
    if (series.representation === 'min-max' && times.length > request.pixelWidth) {
      throw new Error('Trace envelope exceeds the requested pixel budget.')
    }
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i]!
      if (!Number.isFinite(time) || time < window.startTimeS - 1e-8 || time >= window.endTimeS + 1e-8
        || (i > 0 && time <= times[i - 1]!)) throw new Error('Trace sample times are invalid.')
      if (values.some((array) => !Number.isFinite(array[i]) && !Number.isNaN(array[i]))) {
        throw new Error('Trace values must be finite or NaN gaps.')
      }
      if (series.representation === 'min-max') {
        const min = series.minimum[i]!
        const max = series.maximum[i]!
        if (Number.isNaN(min) !== Number.isNaN(max) || min > max) throw new Error('Trace envelope bounds are invalid.')
      }
    }
  }
}
