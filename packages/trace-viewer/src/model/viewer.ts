import type { TraceDataSource, TraceAnnotationIntent } from './trace-data'
import type { TraceSelection } from './selection'
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
  selection?: TraceSelection | null
  onViewportChange?: (viewport: TraceViewport) => void
  onSelectionChange?: (selection: TraceSelection | null) => void
  onBadChannelIntent?: (channelId: string, bad: boolean) => void
  onAnnotationIntent?: (intent: TraceAnnotationIntent) => void
  readOnly?: boolean
  renderer?: 'canvas' | 'svg'
  className?: string
  ariaLabel: string
}
