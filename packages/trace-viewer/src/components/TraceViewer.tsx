import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { SemanticTraceSummary } from '../accessibility/semantic-summary'
import { adjacentAnnotation, visibleAnnotations } from '../annotations/annotation-layout'
import { RequestCoordinator } from '../data-source/request-coordinator'
import { ViewportCache } from '../data-source/viewport-cache'
import { TraceInteractionOverlay } from '../interactions/TraceInteractionOverlay'
import type { TraceAnnotation, TraceAnnotationKind, TraceMetadata, TraceWindow } from '../model/trace-data'
import type { TraceViewerProps, TraceLayer } from '../model/viewer'
import type { TraceViewport } from '../model/viewport'
import { CanvasTraceRenderer } from '../renderers/CanvasTraceRenderer'
import { SvgTraceRenderer } from '../renderers/SvgTraceRenderer'
import { createRenderModel } from '../renderers/TraceRenderer'
import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import { constraintsFromMetadata } from '../state/invariants'
import { useTraceViewer } from '../state/useTraceViewer'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'
import { AnnotationLane } from './AnnotationLane'
import { AnnotationReview, type AnnotationReviewHandle } from './AnnotationReview'
import { ChannelNavigator } from './ChannelNavigator'
import { RecordingOverview } from './RecordingOverview'
import { TraceInteractionStatus } from './TraceInteractionStatus'
import { TraceStatus } from './TraceStatus'
import { TraceToolbar } from './TraceToolbar'

const FALLBACK_STAGE_SIZE = { width: 920, height: 360 } as const

type MetadataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; metadata: readonly TraceMetadata[] }

type WindowState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; layers: readonly LoadedTraceLayer[]; viewport: TraceViewport }

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ height: number; width: number }>(FALLBACK_STAGE_SIZE)

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

/**
 * Returns the previous value while `equal` holds. Hosts routinely rebuild `layers` and
 * `includedChannelIds` on every render; treating those as new would reload the source and reset
 * the viewport each time the host re-renders.
 */
function useStable<T>(value: T, equal: (previous: T, next: T) => boolean): T {
  const [stable, setStable] = useState(value)
  if (stable === value || equal(stable, value)) return stable
  setStable(value)
  return value
}

function sameChannelIds(previous: readonly string[] | undefined, next: readonly string[] | undefined): boolean {
  if (previous === undefined || next === undefined) return previous === next
  return previous.length === next.length && previous.every((id, index) => id === next[index])
}

function sameLayers(previous: readonly TraceLayer[], next: readonly TraceLayer[]): boolean {
  return previous.length === next.length && previous.every((layer, index) => {
    const other = next[index]
    return other !== undefined && layer.id === other.id && layer.source === other.source
      && layer.label === other.label && layer.color === other.color && layer.lineStyle === other.lineStyle
  })
}

function sameLayerSources(previous: readonly TraceLayer[], next: readonly TraceLayer[]): boolean {
  return previous.length === next.length && previous.every((layer, index) => (
    layer.id === next[index]?.id && layer.source === next[index]?.source
  ))
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

function TraceStage({
  announce,
  ariaLabel,
  dispatch,
  helpId,
  height,
  interactive,
  layers,
  onBadChannelIntent,
  overviewAnnotations,
  readOnly,
  renderer,
  state,
  width,
}: {
  announce: (message: string) => void
  ariaLabel: string
  dispatch: (action: TraceViewerAction) => void
  height: number
  helpId: string
  interactive: boolean
  layers: readonly LoadedTraceLayer[]
  onBadChannelIntent: ((channelId: string, bad: boolean) => void) | undefined
  overviewAnnotations: readonly TraceAnnotation[]
  readOnly: boolean
  renderer: 'canvas' | 'svg'
  state: TraceViewerInteractionState
  width: number
}) {
  const metadata = layers[0]?.metadata
  if (metadata === undefined) throw new Error('Trace metadata is unavailable.')
  const rendererProps = useMemo(() => ({
    ariaLabel,
    height,
    layers,
    viewport: state.viewport,
    width,
  }), [ariaLabel, height, layers, state.viewport, width])
  const model = useMemo(() => createRenderModel(rendererProps), [rendererProps])
  const constraints = useMemo(() => constraintsFromMetadata(metadata), [metadata])
  const canMarkBadChannels = !readOnly && layers.every(({ metadata: layerMetadata }) => (
    layerMetadata.capabilities.canMarkBadChannels
  ))
  const jumpToAnnotation = (annotation: TraceAnnotation): void => {
    dispatch({ type: 'jump-to-time', timeS: annotation.startTimeS })
    announce(`Jumped to ${annotation.label} at ${annotation.startTimeS.toFixed(3)} seconds.`)
  }

  return (
    <>
      {renderer === 'svg' ? <SvgTraceRenderer {...rendererProps} /> : <CanvasTraceRenderer {...rendererProps} />}
      {interactive ? (
        <>
          <ChannelNavigator
            announce={announce}
            canMarkBadChannels={canMarkBadChannels}
            dispatch={dispatch}
            model={model}
            onBadChannelIntent={onBadChannelIntent}
            state={state}
          />
          <TraceInteractionOverlay announce={announce} constraints={constraints} describedById={helpId} dispatch={dispatch} model={model} state={state} />
          <RecordingOverview
            annotations={overviewAnnotations}
            announce={announce}
            dispatch={dispatch}
            left={model.geometry.left}
            metadata={metadata}
            state={state}
            width={model.geometry.width}
          />
        </>
      ) : null}
      <AnnotationLane
        annotations={layers[0]?.window.annotations ?? []}
        interactive={interactive}
        model={model}
        onJump={jumpToAnnotation}
      />
    </>
  )
}

function TraceViewerReady({
  interactive,
  metadataLayers,
  presentationLayers,
  visibleLayers,
  ...props
}: TraceViewerProps & {
  interactive: boolean
  metadataLayers: readonly TraceMetadata[]
  /** Same layers as `visibleLayers`, with their current label, color and line style. */
  presentationLayers: readonly TraceLayer[]
  visibleLayers: readonly TraceLayer[]
}) {
  const canonical = metadataLayers[0]
  if (canonical === undefined) throw new Error('Trace metadata is unavailable.')
  const includedChannelIds = props.includedChannelIds
  const includedChannelSet = useMemo(() => (
    includedChannelIds === undefined ? null : new Set(includedChannelIds)
  ), [includedChannelIds])
  const displayMetadataLayers = useMemo(() => metadataLayers.map((metadata) => ({
    ...metadata,
    channels: includedChannelSet === null
      ? metadata.channels
      : metadata.channels.filter(({ id }) => includedChannelSet.has(id)),
  })), [includedChannelSet, metadataLayers])
  const displayMetadata = displayMetadataLayers[0]
  if (displayMetadata === undefined) throw new Error('Trace metadata is unavailable.')
  const controller = useTraceViewer(displayMetadata, props)
  const annotationEditor = useRef<AnnotationReviewHandle>(null)
  const { ref: stageRef, size } = useElementSize()
  const [windowState, setWindowState] = useState<WindowState>({ status: 'loading' })
  const cache = useMemo(() => new ViewportCache(), [])
  const coordinators = useMemo(() => visibleLayers.map(({ source }) => ({
    foreground: new RequestCoordinator(source, cache),
    background: new RequestCoordinator(source, cache),
  })), [cache, visibleLayers])
  const [announcement, setAnnouncement] = useState('')
  const [visibleAnnotationKinds, setVisibleAnnotationKinds] = useState<Record<TraceAnnotationKind, boolean>>({
    annotation: true,
    event: true,
    'bad-segment': true,
  })
  const helpId = useId()
  const { viewport } = controller.state
  const channelIds = useMemo(() => displayMetadata.channels
    .slice(viewport.channelOffset, viewport.channelOffset + viewport.visibleChannelCount)
    .map(({ id }) => id), [displayMetadata.channels, viewport.channelOffset, viewport.visibleChannelCount])
  const requestViewport = useMemo(() => ({
    startTimeS: viewport.startTimeS,
    durationS: viewport.durationS,
    channelOffset: viewport.channelOffset,
    visibleChannelCount: viewport.visibleChannelCount,
    gainByType: {},
  }), [viewport.startTimeS, viewport.durationS, viewport.channelOffset, viewport.visibleChannelCount])

  useEffect(() => {
    const abortController = new AbortController()
    let current = true
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const stopPrefetch = () => {
      if (document.hidden) coordinators.forEach(({ background }) => background.cancel())
    }
    document.addEventListener('visibilitychange', stopPrefetch)
    setWindowState((currentState) => currentState.status === 'ready' ? currentState : { status: 'loading' })

    async function load(): Promise<void> {
      try {
        const windows = await Promise.all(visibleLayers.map((layer, index) => {
          const layerMetadata = displayMetadataLayers[index]
          if (layerMetadata === undefined) throw new Error(`Metadata is unavailable for layer ${layer.id}.`)
          return coordinators[index]!.foreground.request({
            sourceRevision: layerMetadata.revision,
            startTimeS: requestViewport.startTimeS,
            durationS: requestViewport.durationS,
            channelIds,
            pixelWidth: Math.max(1, size.width),
            preferredRepresentation: 'auto',
          }, abortController.signal)
        }))
        const loaded = visibleLayers.map((layer, index): LoadedTraceLayer => {
          const metadata = displayMetadataLayers[index]
          const window = windows[index]
          if (metadata === undefined || window === undefined) throw new Error(`Layer ${layer.id} did not return data.`)
          validateWindow(metadata, window)
          return { layer, metadata, window }
        })
        if (current) {
          setWindowState({ status: 'ready', layers: loaded, viewport: requestViewport })
          // Delay speculative work until navigation settles. One adjacent window at a time.
          idleTimer = setTimeout(() => {
            void (async () => {
              for (const direction of [1, -1]) {
                if (!current || document.hidden) return
                const startTimeS = requestViewport.startTimeS + direction * requestViewport.durationS
                if (startTimeS < metadataLayers[0]!.startTimeS
                  || startTimeS + requestViewport.durationS > metadataLayers[0]!.startTimeS + metadataLayers[0]!.durationS) continue
                await Promise.all(coordinators.map(({ background }, index) => background.request({
                  sourceRevision: displayMetadataLayers[index]!.revision,
                  startTimeS,
                  durationS: requestViewport.durationS,
                  channelIds,
                  pixelWidth: Math.max(1, size.width),
                  preferredRepresentation: 'auto',
                }, abortController.signal)))
              }
            })().catch(() => { /* Speculative failures never replace the foreground viewport. */ })
          }, 180)
        }
      } catch (error: unknown) {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setWindowState({ status: 'error', message: errorMessage(error) })
        }
      }
    }

    void load()
    return () => {
      current = false
      abortController.abort()
      clearTimeout(idleTimer)
      coordinators.forEach(({ foreground, background }) => { foreground.cancel(); background.cancel() })
      document.removeEventListener('visibilitychange', stopPrefetch)
    }
  }, [channelIds, displayMetadataLayers, size.width, requestViewport, visibleLayers, coordinators, metadataLayers])

  const renderer = props.renderer ?? 'canvas'
  const windowPending = windowState.status === 'ready' && (
    windowState.viewport.startTimeS !== viewport.startTimeS
    || windowState.viewport.durationS !== viewport.durationS
    || windowState.viewport.channelOffset !== viewport.channelOffset
    || windowState.viewport.visibleChannelCount !== viewport.visibleChannelCount
  )
  const renderedViewport = useMemo(() => windowState.status === 'ready'
    ? { ...windowState.viewport, gainByType: viewport.gainByType }
    : viewport, [viewport, windowState])
  const renderedState = { ...controller.state, viewport: renderedViewport }
  const readOnly = props.readOnly ?? true
  const intentEnabled = !readOnly
    && props.onBadChannelIntent !== undefined
    && displayMetadataLayers.every(({ capabilities }) => capabilities.canMarkBadChannels)
  const overviewAnnotations = useMemo(() => visibleAnnotations(
    displayMetadata.annotations,
    visibleAnnotationKinds,
  ), [displayMetadata.annotations, visibleAnnotationKinds])
  const displayWindowLayers = useMemo(() => windowState.status === 'ready'
    ? windowState.layers.map((loaded, index) => ({
      ...loaded,
      layer: presentationLayers[index]?.id === loaded.layer.id ? presentationLayers[index] : loaded.layer,
      window: {
        ...loaded.window,
        annotations: visibleAnnotations(loaded.window.annotations, visibleAnnotationKinds),
      },
    }))
    : [], [presentationLayers, visibleAnnotationKinds, windowState])
  const jumpAnnotation = (direction: 'next' | 'previous'): void => {
    const referenceTimeS = controller.state.cursor?.timeS
      ?? (direction === 'next'
        ? controller.state.viewport.startTimeS
        : controller.state.viewport.startTimeS + controller.state.viewport.durationS)
    const target = adjacentAnnotation(overviewAnnotations, referenceTimeS, direction)
    if (target === undefined) return
    controller.dispatch({ type: 'jump-to-time', timeS: target.startTimeS })
    setAnnouncement(`Jumped to ${target.label} at ${target.startTimeS.toFixed(3)} seconds.`)
  }
  return (
    <>
      {windowState.status === 'ready' ? (
        <TraceToolbar
          dispatch={controller.dispatch}
          interactive={interactive}
          intentEnabled={intentEnabled}
          layers={displayWindowLayers}
          metadata={displayMetadata}
          onJumpAnnotation={jumpAnnotation}
          onToggleAnnotationKind={(kind) => setVisibleAnnotationKinds((current) => ({
            ...current,
            [kind]: !current[kind],
          }))}
          state={controller.state}
          visibleAnnotationKinds={visibleAnnotationKinds}
        />
      ) : null}
      {interactive && !readOnly && props.onAnnotationIntent !== undefined
        && metadataLayers.every(({ capabilities }) => capabilities.canEditAnnotations) ? (
          <AnnotationReview ref={annotationEditor} annotations={canonical.annotations} cursor={controller.state.cursor}
            selection={controller.state.selection} onIntent={props.onAnnotationIntent} announce={setAnnouncement} />
        ) : null}
      <div aria-busy={windowPending || windowState.status === 'loading'} className="nsv-stage" ref={stageRef}
        onContextMenu={(event) => {
          if (!annotationEditor.current || !(event.target instanceof Element)) return
          const annotationId = event.target.closest('[data-annotation-id]')?.getAttribute('data-annotation-id')
          if (annotationId) {
            event.preventDefault()
            annotationEditor.current.openExisting([annotationId])
            return
          }
          const surface = event.target.closest('.nsv-interaction-overlay')
          if (!surface) return
          const bounds = surface.getBoundingClientRect()
          if (bounds.width <= 0) return
          const timeS = renderedViewport.startTimeS + (event.clientX - bounds.left) / bounds.width * renderedViewport.durationS
          const selected = controller.state.selection
          const inSelection = selected !== null && timeS >= selected.startTimeS && timeS <= selected.endTimeS
          if (!inSelection) {
            const tolerance = 5 / bounds.width * renderedViewport.durationS
            const hits = overviewAnnotations.filter((annotation) => annotation.durationS === 0
              ? Math.abs(annotation.startTimeS - timeS) <= tolerance
              : timeS >= annotation.startTimeS && timeS <= annotation.startTimeS + annotation.durationS)
            if (hits.length > 0) {
              event.preventDefault()
              annotationEditor.current.openExisting(hits.map(({ id }) => id))
              return
            }
          }
          if (!controller.state.selection && !controller.state.cursor) return
          event.preventDefault()
          annotationEditor.current.openNew()
        }}>
        {windowPending ? <span className="nsv-sr-only" role="status">Loading requested viewport; showing previous window.</span> : null}
        {windowState.status === 'loading' ? <TraceStatus kind="loading" message="Loading signal viewport…" /> : null}
        {windowState.status === 'error' ? <TraceStatus kind="error" message={windowState.message} /> : null}
        {windowState.status === 'ready' ? (
          <TraceStage
            announce={setAnnouncement}
            ariaLabel={props.ariaLabel}
            dispatch={controller.dispatch}
            height={Math.max(220, size.height)}
            helpId={helpId}
            interactive={interactive}
            layers={displayWindowLayers}
            onBadChannelIntent={props.onBadChannelIntent}
            overviewAnnotations={overviewAnnotations}
            readOnly={readOnly}
            renderer={renderer}
            state={renderedState}
            width={size.width}
          />
        ) : null}
      </div>
      {windowState.status === 'ready' ? (
        <>
          {interactive ? <TraceInteractionStatus helpId={helpId} layers={displayWindowLayers} state={renderedState} /> : null}
          <SemanticTraceSummary layers={displayWindowLayers} viewport={renderedState.viewport} />
        </>
      ) : null}
      <div aria-atomic="true" aria-live="polite" className="nsv-sr-only">{announcement}</div>
    </>
  )
}

export function TraceViewer(props: TraceViewerProps) {
  const { ariaLabel, className, layers } = props
  const interactive = props.interactive ?? true
  const presentationLayers = useStable(
    useMemo(() => layers.filter(({ visible }) => visible !== false), [layers]),
    sameLayers,
  )
  // Only a change of source reloads data; label, color and line style are presentation.
  const visibleLayers = useStable(presentationLayers, sameLayerSources)
  const includedChannelIds = useStable(props.includedChannelIds, sameChannelIds)
  const includedChannelKey = includedChannelIds?.join('\u0000') ?? ''
  const [metadataState, setMetadataState] = useState<MetadataState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setMetadataState({ status: 'loading' })

    async function load(): Promise<void> {
      try {
        if (!ariaLabel.trim()) throw new Error('TraceViewer requires a non-empty ariaLabel.')
        if (visibleLayers.length === 0) throw new Error('At least one visible trace layer is required.')
        const metadata = await Promise.all(visibleLayers.map(({ source }) => source.getMetadata(controller.signal)))
        validateMetadata(metadata)
        if (includedChannelIds !== undefined) {
          const included = new Set(includedChannelIds)
          if (!metadata[0]?.channels.some(({ id }) => included.has(id))) {
            throw new Error('includedChannelIds must contain at least one channel from the trace source.')
          }
        }
        if (current) setMetadataState({ status: 'ready', metadata })
      } catch (error: unknown) {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setMetadataState({ status: 'error', message: errorMessage(error) })
        }
      }
    }

    void load()
    return () => {
      current = false
      controller.abort()
    }
  }, [ariaLabel, includedChannelIds, visibleLayers])

  const rootClassName = ['nsv-viewer', interactive ? 'is-interactive' : 'is-static', className].filter(Boolean).join(' ')
  return (
    <section aria-busy={metadataState.status === 'loading'} aria-label={`${ariaLabel} controls`} className={rootClassName}>
      {metadataState.status === 'loading' ? <TraceStatus kind="loading" message="Loading signal metadata…" /> : null}
      {metadataState.status === 'error' ? <TraceStatus kind="error" message={metadataState.message} /> : null}
      {metadataState.status === 'ready' ? (
        <TraceViewerReady
          {...props}
          {...(includedChannelIds === undefined ? {} : { includedChannelIds })}
          interactive={interactive}
          key={`${metadataState.metadata.map(({ sourceId, revision }) => `${sourceId}:${revision}`).join('|')}|${includedChannelKey}`}
          metadataLayers={metadataState.metadata}
          presentationLayers={presentationLayers}
          visibleLayers={visibleLayers}
        />
      ) : null}
    </section>
  )
}
