import { useId, useMemo } from 'react'

import type { TraceSeries } from '../model/trace-data'
import {
  createRenderModel,
  formatTime,
  timeToX,
  traceDash,
  valueToY,
} from './TraceRenderer'
import type { TraceRendererProps, TraceRenderModel } from './TraceRenderer'

function pointPath(series: Extract<TraceSeries, { representation: 'points' }>, channelIndex: number, channelId: string, model: TraceRenderModel): string {
  const channel = model.channels[channelIndex]
  if (channel === undefined || channel.id !== channelId) return ''
  let path = ''
  let drawing = false
  const count = Math.min(series.timesS.length, series.values.length)
  for (let index = 0; index < count; index += 1) {
    const timeS = series.timesS[index]
    const value = series.values[index]
    if (timeS === undefined || value === undefined || !Number.isFinite(timeS) || !Number.isFinite(value)) {
      drawing = false
      continue
    }
    const command = drawing ? 'L' : 'M'
    path += `${command}${timeToX(timeS, model).toFixed(2)},${valueToY(value, channel, channelIndex, model).toFixed(2)}`
    drawing = true
  }
  return path
}

function envelopePath(series: Extract<TraceSeries, { representation: 'min-max' }>, channelIndex: number, channelId: string, model: TraceRenderModel): string {
  const channel = model.channels[channelIndex]
  if (channel === undefined || channel.id !== channelId) return ''
  let path = ''
  const count = Math.min(series.bucketStartTimesS.length, series.minimum.length, series.maximum.length)
  for (let index = 0; index < count; index += 1) {
    const timeS = series.bucketStartTimesS[index]
    const minimum = series.minimum[index]
    const maximum = series.maximum[index]
    if (timeS === undefined || minimum === undefined || maximum === undefined
      || !Number.isFinite(timeS) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) continue
    const x = timeToX(timeS, model).toFixed(2)
    path += `M${x},${valueToY(minimum, channel, channelIndex, model).toFixed(2)}`
      + `L${x},${valueToY(maximum, channel, channelIndex, model).toFixed(2)}`
  }
  return path
}

export function SvgTraceRenderer(props: TraceRendererProps) {
  const clipId = `nsv-clip-${useId().replace(/:/g, '')}`
  const model = useMemo(() => createRenderModel(props), [props])
  const { geometry } = model

  return (
    <svg
      aria-label={props.ariaLabel}
      className="nsv-plot nsv-svg-plot"
      height={props.height}
      role="img"
      viewBox={`0 0 ${props.width} ${props.height}`}
      width={props.width}
    >
      <defs>
        <clipPath id={clipId}>
          <rect height={geometry.height} width={geometry.width} x={geometry.left} y={geometry.top} />
        </clipPath>
      </defs>
      <rect className="nsv-field" height={geometry.height} width={geometry.width} x={geometry.left} y={geometry.top} />
      {model.layers[0]?.window.annotations.map((annotation) => {
        const start = Math.max(model.viewport.startTimeS, annotation.startTimeS)
        const end = Math.min(model.viewport.startTimeS + model.viewport.durationS, annotation.startTimeS + annotation.durationS)
        if (end <= start) return null
        return (
          <rect
            className="nsv-annotation"
            height={geometry.height}
            key={annotation.id}
            style={annotation.color === undefined ? undefined : { fill: annotation.color }}
            width={Math.max(1, timeToX(end, model) - timeToX(start, model))}
            x={timeToX(start, model)}
            y={geometry.top}
          />
        )
      })}
      {model.ticks.map((tick) => (
        <g key={tick}>
          <line className="nsv-time-grid" x1={timeToX(tick, model)} x2={timeToX(tick, model)} y1={geometry.top} y2={geometry.top + geometry.height} />
          <text className="nsv-time-label" textAnchor="middle" x={timeToX(tick, model)} y={props.height - 11}>
            {formatTime(tick, model.viewport.durationS)}
          </text>
        </g>
      ))}
      {model.channels.map((channel, channelIndex) => {
        const centerY = geometry.top + geometry.rowHeight * (channelIndex + 0.5)
        return (
          <g key={channel.id}>
            {channelIndex > 0 && <line className="nsv-row-divider" x1={geometry.left} x2={geometry.left + geometry.width} y1={geometry.top + geometry.rowHeight * channelIndex} y2={geometry.top + geometry.rowHeight * channelIndex} />}
            <line className="nsv-baseline" x1={geometry.left} x2={geometry.left + geometry.width} y1={centerY} y2={centerY} />
            <text className={`nsv-channel-label${channel.bad ? ' is-bad' : ''}`} textAnchor="end" x={geometry.left - 13} y={centerY - 2}>{channel.label}</text>
            <text className="nsv-channel-unit" textAnchor="end" x={geometry.left - 13} y={centerY + 11}>{channel.unit}{channel.bad ? ' · BAD' : ''}</text>
            {model.layers.map(({ layer, window }) => {
              const series = window.channels.get(channel.id)
              if (series === undefined) return null
              const path = series.representation === 'points'
                ? pointPath(series, channelIndex, channel.id, model)
                : envelopePath(series, channelIndex, channel.id, model)
              return (
                <path
                  className="nsv-trace"
                  clipPath={`url(#${clipId})`}
                  d={path}
                  data-layer={layer.id}
                  key={layer.id}
                  style={{
                    stroke: layer.color ?? 'var(--nsv-trace-color)',
                    strokeDasharray: traceDash(layer.lineStyle).join(' '),
                  }}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </g>
        )
      })}
      <text className="nsv-axis-label" textAnchor="middle" x={geometry.left + geometry.width / 2} y={props.height - 1}>Time (s)</text>
    </svg>
  )
}
