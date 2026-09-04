import type { TraceDataSource, TraceAnnotationIntent } from './trace-data'
import type { TraceCursor, TraceSelection } from './selection'
import type { TraceViewport } from './viewport'

export interface TraceLayer {
  id: string
  label: string
  source: TraceDataSource
  visible?: boolean
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  color?: string
}

export interface TraceViewerProps {
  layers: readonly TraceLayer[]
  viewport?: TraceViewport
  defaultViewport?: Partial<TraceViewport>
  cursor?: TraceCursor | null
  defaultCursor?: TraceCursor | null
  selection?: TraceSelection | null
  defaultSelection?: TraceSelection | null
  includedChannelIds?: readonly string[]
  selectedChannelIds?: readonly string[]
  defaultSelectedChannelIds?: readonly string[]
  onViewportChange?: (viewport: TraceViewport) => void
  onCursorChange?: (cursor: TraceCursor | null) => void
  onSelectionChange?: (selection: TraceSelection | null) => void
  onSelectedChannelIdsChange?: (channelIds: readonly string[]) => void
  onBadChannelIntent?: (channelId: string, bad: boolean) => void
  onAnnotationIntent?: (intent: TraceAnnotationIntent) => void
  readOnly?: boolean
  interactive?: boolean
  renderer?: 'canvas' | 'svg'
  className?: string
  ariaLabel: string
}
