import { useEffect, useMemo, useRef, useState } from 'react'

import { SemanticTraceSummary } from '../accessibility/semantic-summary'
import type { TraceMetadata, TraceWindow } from '../model/trace-data'
import type { TraceViewerProps } from '../model/viewer'
import type { TraceViewport } from '../model/viewport'
import { CanvasTraceRenderer } from '../renderers/CanvasTraceRenderer'
import { SvgTraceRenderer } from '../renderers/SvgTraceRenderer'
import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import { TraceStatus } from './TraceStatus'
import { TraceToolbar } from './TraceToolbar'

const FALLBACK_SIZE: { width: number; height: number } = { width: 920, height: 480 }

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; layers: readonly LoadedTraceLayer[]; viewport: TraceViewport }

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(FALLBACK_SIZE)

  useEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setSize({ width: Math.round(width), height: Math.round(height) }))
    }
    const bounds = element.getBoundingClientRect()
    update(bounds.width, bounds.height)
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return { ref, size }
}

function resolveViewport(metadata: TraceMetadata, controlled: TraceViewport | undefined, defaults: Partial<TraceViewport> | undefined): TraceViewport {
  const candidate = controlled ?? {
    startTimeS: defaults?.startTimeS ?? metadata.startTimeS,
    durationS: defaults?.durationS ?? metadata.durationS,
    channelOffset: defaults?.channelOffset ?? 0,
    visibleChannelCount: defaults?.visibleChannelCount ?? metadata.channels.length,
    gainByType: defaults?.gainByType ?? {},
  }
  const minimumDuration = 1 / metadata.samplingRateHz
  const durationS = Math.min(metadata.durationS, Math.max(minimumDuration, candidate.durationS))
  const maximumStart = metadata.startTimeS + metadata.durationS - durationS
  const startTimeS = Math.min(maximumStart, Math.max(metadata.startTimeS, candidate.startTimeS))
  const visibleChannelCount = Math.min(metadata.channels.length, Math.max(1, Math.floor(candidate.visibleChannelCount)))
  const channelOffset = Math.min(metadata.channels.length - visibleChannelCount, Math.max(0, Math.floor(candidate.channelOffset)))
  return { ...candidate, startTimeS, durationS, visibleChannelCount, channelOffset }
}

function validateMetadata(metadata: readonly TraceMetadata[]): void {
  const canonical = metadata[0]
  if (canonical === undefined) throw new Error('At least one visible trace layer is required.')
  if (canonical.channels.length === 0) throw new Error('The trace source has no channels.')
  const canonicalById = new Map(canonical.channels.map((channel) => [channel.id, channel]))

  for (const layerMetadata of metadata.slice(1)) {
    if (layerMetadata.channels.length !== canonical.channels.length) {
      throw new Error('Trace layers are incompatible: channel counts differ.')
    }
    for (const channel of layerMetadata.channels) {
      const expected = canonicalById.get(channel.id)
      if (expected === undefined) throw new Error(`Trace layers are incompatible: channel ${channel.id} is missing.`)
      if (expected.unit !== channel.unit) {
        throw new Error(`Trace layers are incompatible: ${channel.id} uses both ${expected.unit} and ${channel.unit}.`)
      }
    }
    const toleranceS = 0.5 / Math.max(canonical.samplingRateHz, layerMetadata.samplingRateHz)
    if (Math.abs(canonical.startTimeS - layerMetadata.startTimeS) > toleranceS
      || Math.abs(canonical.durationS - layerMetadata.durationS) > toleranceS) {
      throw new Error('Trace layers are incompatible: time coordinates differ.')
    }
    if (Math.abs(canonical.samplingRateHz - layerMetadata.samplingRateHz) > 0.001) {
      throw new Error('Trace layers are incompatible: sampling rates differ.')
    }
  }
}

function validateWindow(metadata: TraceMetadata, window: TraceWindow): void {
  if (window.sourceId !== metadata.sourceId || window.sourceRevision !== metadata.revision) {
    throw new Error(`Trace source ${metadata.sourceId} returned a stale or mismatched window.`)
  }
  if (!(window.startTimeS < window.endTimeS)) throw new Error('Trace source returned an empty time window.')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The trace viewport could not be loaded.'
}

export function TraceViewer({
  ariaLabel,
  className,
  defaultViewport,
  layers,
  readOnly = true,
  renderer = 'canvas',
  viewport,
}: TraceViewerProps) {
  const { ref, size } = useElementSize()
  const visibleLayers = useMemo(() => layers.filter(({ visible }) => visible !== false), [layers])
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setLoadState({ status: 'loading' })

    async function load(): Promise<void> {
      try {
        if (!ariaLabel.trim()) throw new Error('TraceViewer requires a non-empty ariaLabel.')
        if (visibleLayers.length === 0) throw new Error('At least one visible trace layer is required.')
        const metadata = await Promise.all(visibleLayers.map(({ source }) => source.getMetadata(controller.signal)))
        validateMetadata(metadata)
        const canonical = metadata[0]
        if (canonical === undefined) throw new Error('Trace metadata is unavailable.')
        const resolvedViewport = resolveViewport(canonical, viewport, defaultViewport)
        const channelIds = canonical.channels
          .slice(resolvedViewport.channelOffset, resolvedViewport.channelOffset + resolvedViewport.visibleChannelCount)
          .map(({ id }) => id)
        const windows = await Promise.all(visibleLayers.map((layer, index) => {
          const layerMetadata = metadata[index]
          if (layerMetadata === undefined) throw new Error(`Metadata is unavailable for layer ${layer.id}.`)
          return layer.source.getWindow({
            sourceRevision: layerMetadata.revision,
            startTimeS: resolvedViewport.startTimeS,
            durationS: resolvedViewport.durationS,
            channelIds,
            pixelWidth: Math.max(1, size.width),
            preferredRepresentation: 'auto',
          }, controller.signal)
        }))
        const loaded = visibleLayers.map((layer, index): LoadedTraceLayer => {
          const layerMetadata = metadata[index]
          const window = windows[index]
          if (layerMetadata === undefined || window === undefined) throw new Error(`Layer ${layer.id} did not return data.`)
          validateWindow(layerMetadata, window)
          return { layer, metadata: layerMetadata, window }
        })
        if (current) setLoadState({ status: 'ready', layers: loaded, viewport: resolvedViewport })
      } catch (error: unknown) {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadState({ status: 'error', message: errorMessage(error) })
        }
      }
    }

    void load()
    return () => {
      current = false
      controller.abort()
    }
  }, [ariaLabel, defaultViewport, size.width, viewport, visibleLayers])

  const rootClassName = ['nsv-viewer', className].filter(Boolean).join(' ')
  return (
    <section aria-busy={loadState.status === 'loading'} aria-label={`${ariaLabel} controls`} className={rootClassName} ref={ref}>
      {loadState.status === 'loading' && <TraceStatus kind="loading" message="Loading signal viewport…" />}
      {loadState.status === 'error' && <TraceStatus kind="error" message={loadState.message} />}
      {loadState.status === 'ready' && (
        <>
          <TraceToolbar layers={loadState.layers} readOnly={readOnly} />
          <div className="nsv-stage">
            {renderer === 'svg'
              ? <SvgTraceRenderer ariaLabel={ariaLabel} height={Math.max(260, size.height - 72)} layers={loadState.layers} viewport={loadState.viewport} width={size.width} />
              : <CanvasTraceRenderer ariaLabel={ariaLabel} height={Math.max(260, size.height - 72)} layers={loadState.layers} viewport={loadState.viewport} width={size.width} />}
          </div>
          <SemanticTraceSummary layers={loadState.layers} viewport={loadState.viewport} />
        </>
      )}
    </section>
  )
}
