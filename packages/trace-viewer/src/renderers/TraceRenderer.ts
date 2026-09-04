import { layoutAnnotations } from '../annotations/annotation-layout'
import type { TraceChannel } from '../model/channel'
import type { TraceMetadata, TraceSeries, TraceWindow } from '../model/trace-data'
import type { TraceLayer } from '../model/viewer'
import type { TraceViewport } from '../model/viewport'

export interface LoadedTraceLayer {
  layer: TraceLayer
  metadata: TraceMetadata
  window: TraceWindow
}

export interface TraceRendererProps {
  ariaLabel: string
  height: number
  layers: readonly LoadedTraceLayer[]
  viewport: TraceViewport
  width: number
}

export interface PlotGeometry {
  bottom: number
  height: number
  left: number
  right: number
  rowHeight: number
  top: number
  width: number
}

export interface TraceRenderModel {
  amplitudeByUnit: ReadonlyMap<string, number>
  channels: readonly TraceChannel[]
  geometry: PlotGeometry
  layers: readonly LoadedTraceLayer[]
  ticks: readonly number[]
  viewport: TraceViewport
}

export function niceAmplitude(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const normalized = value / power
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * power
}

export function forEachFiniteValue(series: TraceSeries, visit: (value: number) => void): void {
  if (series.representation === 'points') {
    for (const value of series.values) if (Number.isFinite(value)) visit(value)
    return
  }
  for (const value of series.minimum) if (Number.isFinite(value)) visit(value)
  for (const value of series.maximum) if (Number.isFinite(value)) visit(value)
}

export function createRenderModel(props: TraceRendererProps): TraceRenderModel {
  const channels = props.layers[0]?.metadata.channels.slice(
    props.viewport.channelOffset,
    props.viewport.channelOffset + props.viewport.visibleChannelCount,
  ) ?? []
  const left = Math.min(118, Math.max(76, props.width * 0.13))
  const right = 22
  const plotWidth = Math.max(1, props.width - left - right)
  const annotationLayout = layoutAnnotations(
    props.layers[0]?.window.annotations ?? [],
    props.viewport,
    plotWidth,
  )
  const annotationLaneCount = Math.min(4, annotationLayout.reduce((maximum, item) => Math.max(maximum, item.lane + 1), 0))
  const top = annotationLaneCount === 0 ? 10 : 14 + annotationLaneCount * 19
  const bottom = 58
  const plotHeight = Math.max(1, props.height - top - bottom)
  const amplitudeMaxByUnit = new Map<string, number>()

  for (const channel of channels) {
    let maximum = amplitudeMaxByUnit.get(channel.unit) ?? 0
    for (const loaded of props.layers) {
      const series = loaded.window.channels.get(channel.id)
      if (series === undefined) continue
      forEachFiniteValue(series, (value) => { maximum = Math.max(maximum, Math.abs(value)) })
    }
    amplitudeMaxByUnit.set(channel.unit, maximum)
  }

  const amplitudeByUnit = new Map<string, number>()
  for (const [unit, maximum] of amplitudeMaxByUnit) amplitudeByUnit.set(unit, niceAmplitude(maximum))
  const tickCount = props.width < 540 ? 4 : 7
  const ticks = Array.from(
    { length: tickCount },
    (_, index) => props.viewport.startTimeS + (props.viewport.durationS * index) / (tickCount - 1),
  )

  return {
    amplitudeByUnit,
    channels,
    geometry: {
      bottom,
      height: plotHeight,
      left,
      right,
      rowHeight: plotHeight / Math.max(1, channels.length),
      top,
      width: plotWidth,
    },
    layers: props.layers,
    ticks,
    viewport: props.viewport,
  }
}

export function timeToX(timeS: number, model: TraceRenderModel): number {
  const { geometry, viewport } = model
  return geometry.left + ((timeS - viewport.startTimeS) / viewport.durationS) * geometry.width
}

export function valueToY(value: number, channel: TraceChannel, rowIndex: number, model: TraceRenderModel): number {
  const { geometry, viewport } = model
  const center = geometry.top + geometry.rowHeight * (rowIndex + 0.5)
  const amplitude = model.amplitudeByUnit.get(channel.unit) ?? 1
  const gain = viewport.gainByType[channel.type] ?? 1
  return center - value * ((geometry.rowHeight * 0.38) / amplitude) * gain
}

export function formatScale(amplitude: number): string {
  if (amplitude > 0 && amplitude < 0.01) return amplitude.toExponential(1)
  return amplitude < 10 ? amplitude.toFixed(1) : amplitude.toFixed(0)
}

export function formatTime(timeS: number, durationS: number): string {
  return timeS.toFixed(durationS < 10 ? 2 : durationS < 60 ? 1 : 0)
}

export function traceDash(lineStyle: TraceLayer['lineStyle']): readonly number[] {
  if (lineStyle === 'dashed') return [7, 5]
  if (lineStyle === 'dotted') return [2, 4]
  return []
}
