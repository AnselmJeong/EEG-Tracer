import type { CSSProperties } from 'react'

import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import { forEachFiniteValue, formatScale, niceAmplitude } from '../renderers/TraceRenderer'

function scaleLabels(layers: readonly LoadedTraceLayer[]): readonly string[] {
  const maximumByUnit = new Map<string, number>()
  const metadata = layers[0]?.metadata
  if (metadata === undefined) return []
  for (const channel of metadata.channels) {
    let maximum = maximumByUnit.get(channel.unit) ?? 0
    for (const loaded of layers) {
      const series = loaded.window.channels.get(channel.id)
      if (series !== undefined) forEachFiniteValue(series, (value) => { maximum = Math.max(maximum, Math.abs(value)) })
    }
    maximumByUnit.set(channel.unit, maximum)
  }
  return [...maximumByUnit].map(([unit, maximum]) => `±${formatScale(niceAmplitude(maximum))} ${unit}`)
}

export function TraceToolbar({ layers, readOnly }: { layers: readonly LoadedTraceLayer[]; readOnly: boolean }) {
  const metadata = layers[0]?.metadata
  const scales = scaleLabels(layers)
  return (
    <div className="nsv-toolbar">
      <div className="nsv-toolbar-title">
        <span>EEG TRACE VIEWER</span>
        <strong>{metadata?.title ?? metadata?.sourceId ?? 'Signal viewport'}</strong>
      </div>
      <div aria-label="Visible trace layers" className="nsv-layer-key">
        {layers.map(({ layer }, index) => (
          <span key={layer.id}>
            <i
              aria-hidden="true"
              className={`is-${layer.lineStyle ?? 'solid'}`}
              style={{ '--nsv-key-color': layer.color ?? (index === 0 ? '#286d6d' : '#ba6547') } as CSSProperties}
            />
            {layer.label}
          </span>
        ))}
      </div>
      <div className="nsv-scale-readout">
        <span>{layers.length > 1 ? 'LOCKED SCALE' : 'VISIBLE RANGE'}</span>
        <strong>{scales.join(' · ') || 'No finite values'}</strong>
        <small>{readOnly ? 'READ ONLY' : 'INTENT ENABLED'}</small>
      </div>
    </div>
  )
}
