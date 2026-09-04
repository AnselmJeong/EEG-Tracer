import type { LoadedTraceLayer } from '../renderers/TraceRenderer'
import type { TraceViewport } from '../model/viewport'
import { annotationKind } from '../annotations/annotation-layout'

export function SemanticTraceSummary({ layers, viewport }: { layers: readonly LoadedTraceLayer[]; viewport: TraceViewport }) {
  const metadata = layers[0]?.metadata
  if (metadata === undefined) return null
  const visibleChannels = metadata.channels.slice(
    viewport.channelOffset,
    viewport.channelOffset + viewport.visibleChannelCount,
  )
  const representations = new Set(layers.flatMap(({ window }) => [...window.channels.values()].map(({ representation }) => representation)))

  return (
    <div className="nsv-sr-only">
      <p>
        Showing {viewport.durationS.toFixed(2)} seconds from {viewport.startTimeS.toFixed(2)} seconds.
        {' '}{visibleChannels.length} of {metadata.channels.length} channels. Representation: {[...representations].join(', ')}.
      </p>
      <ul>
        {visibleChannels.map((channel) => (
          <li key={channel.id}>{channel.label}, {channel.type}, {channel.unit}, {channel.bad ? 'marked bad' : 'not marked bad'}.</li>
        ))}
      </ul>
      {layers[0]?.window.annotations.length ? (
        <ul aria-label="Semantic annotation details">
          {layers[0].window.annotations.map((annotation) => (
            <li key={annotation.id}>
              {annotationKind(annotation)}, {annotation.label}, starts at {annotation.startTimeS.toFixed(3)} seconds,
              {' '}duration {annotation.durationS.toFixed(3)} seconds.
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
