import { memo, useEffect, useMemo, useRef } from 'react'

import { annotationKind } from '../annotations/annotation-layout'
import type { TraceSeries } from '../model/trace-data'
import {
  createRenderModel,
  formatTime,
  timeToX,
  traceDash,
  valueToY,
} from './TraceRenderer'
import type { TraceRendererProps, TraceRenderModel } from './TraceRenderer'

export function drawSeries(
  context: CanvasRenderingContext2D,
  series: TraceSeries,
  channelIndex: number,
  channelId: string,
  model: TraceRenderModel,
): void {
  const channel = model.channels[channelIndex]
  if (channel === undefined || channel.id !== channelId) return
  context.beginPath()
  if (series.representation === 'points') {
    let drawing = false
    const count = Math.min(series.timesS.length, series.values.length)
    for (let index = 0; index < count; index += 1) {
      const timeS = series.timesS[index]
      const value = series.values[index]
      if (timeS === undefined || value === undefined || !Number.isFinite(timeS) || !Number.isFinite(value)) {
        drawing = false
        continue
      }
      const x = timeToX(timeS, model)
      const y = valueToY(value, channel, channelIndex, model)
      if (drawing) context.lineTo(x, y)
      else context.moveTo(x, y)
      drawing = true
    }
  } else {
    const count = Math.min(series.bucketStartTimesS.length, series.minimum.length, series.maximum.length)
    for (let index = 0; index < count; index += 1) {
      const timeS = series.bucketStartTimesS[index]
      const minimum = series.minimum[index]
      const maximum = series.maximum[index]
      if (timeS === undefined || minimum === undefined || maximum === undefined
        || !Number.isFinite(timeS) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) continue
      const x = timeToX(timeS, model)
      context.moveTo(x, valueToY(minimum, channel, channelIndex, model))
      context.lineTo(x, valueToY(maximum, channel, channelIndex, model))
    }
  }
  context.stroke()
}

export const CanvasTraceRenderer = memo(function CanvasTraceRenderer(props: TraceRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const model = useMemo(() => createRenderModel(props), [props])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas === null || canvas === undefined || context === null || context === undefined) return
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(props.width * ratio)
    canvas.height = Math.round(props.height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, props.width, props.height)

    const { geometry } = model
    const root = canvas.closest('.nsv-viewer') ?? canvas
    const styles = getComputedStyle(root)
    const fieldColor = styles.getPropertyValue('--nsv-field').trim() || '#edf1ef'
    const lineColor = styles.getPropertyValue('--nsv-line').trim() || '#d3dad6'
    const strongLineColor = styles.getPropertyValue('--nsv-line-strong').trim() || '#b8c3bd'
    const mutedColor = styles.getPropertyValue('--nsv-muted').trim() || '#69756f'
    const defaultTraceColor = styles.getPropertyValue('--nsv-trace-color').trim() || '#286d6d'
    context.fillStyle = fieldColor
    context.fillRect(geometry.left, geometry.top, geometry.width, geometry.height)

    for (const annotation of model.layers[0]?.window.annotations ?? []) {
      const start = Math.max(model.viewport.startTimeS, annotation.startTimeS)
      const end = Math.min(model.viewport.startTimeS + model.viewport.durationS, annotation.startTimeS + annotation.durationS)
      const kind = annotationKind(annotation)
      if (kind !== 'event' && end < start) continue
      if (kind === 'event' && (annotation.startTimeS < model.viewport.startTimeS
        || annotation.startTimeS > model.viewport.startTimeS + model.viewport.durationS)) continue
      context.fillStyle = annotation.color
        ?? (kind === 'bad-segment' ? 'rgba(176, 57, 57, 0.14)' : kind === 'event' ? 'rgba(40, 109, 109, 0.55)' : 'rgba(198, 101, 60, 0.12)')
      context.fillRect(
        timeToX(start, model),
        geometry.top,
        kind === 'event' ? 1.5 : Math.max(1, timeToX(end, model) - timeToX(start, model)),
        geometry.height,
      )
    }

    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    context.textBaseline = 'middle'
    for (const tick of model.ticks) {
      const x = timeToX(tick, model)
      context.strokeStyle = lineColor
      context.setLineDash([2, 5])
      context.beginPath()
      context.moveTo(x, geometry.top)
      context.lineTo(x, geometry.top + geometry.height)
      context.stroke()
      context.fillStyle = mutedColor
      context.textAlign = 'center'
      context.fillText(formatTime(tick, model.viewport.durationS), x, props.height - 40)
    }

    context.save()
    context.beginPath()
    context.rect(geometry.left, geometry.top, geometry.width, geometry.height)
    context.clip()
    model.channels.forEach((channel, channelIndex) => {
      const centerY = geometry.top + geometry.rowHeight * (channelIndex + 0.5)
      context.strokeStyle = strongLineColor
      context.lineWidth = 0.75
      context.setLineDash([])
      context.beginPath()
      context.moveTo(geometry.left, centerY)
      context.lineTo(geometry.left + geometry.width, centerY)
      context.stroke()
      for (const { layer, window } of model.layers) {
        const series = window.channels.get(channel.id)
        if (series === undefined) continue
        context.strokeStyle = layer.color ?? defaultTraceColor
        context.lineWidth = layer.lineStyle === 'solid' || layer.lineStyle === undefined ? 1.45 : 1.2
        context.setLineDash([...traceDash(layer.lineStyle)])
        drawSeries(context, series, channelIndex, channel.id, model)
      }
    })
    context.restore()
  }, [model, props.height, props.width])

  return (
    <div className="nsv-canvas-shell">
      <canvas
        aria-label={props.ariaLabel}
        className="nsv-plot nsv-canvas-plot"
        ref={canvasRef}
        role="img"
        style={{ height: props.height, width: props.width }}
      />
      <div aria-hidden="true" className="nsv-canvas-labels">
        {model.channels.map((channel, index) => (
          <span className={channel.bad ? 'is-bad' : ''} key={channel.id} style={{ top: model.geometry.top + model.geometry.rowHeight * (index + 0.5) }}>
            <b>{channel.label}</b><small>{channel.unit}{channel.bad ? ' · BAD' : ''}</small>
          </span>
        ))}
      </div>
    </div>
  )
})
