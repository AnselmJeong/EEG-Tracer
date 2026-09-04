import { describe, expect, it } from 'vitest'

import { adjacentAnnotation, layoutAnnotations } from '../src/annotations/annotation-layout'
import type { TraceAnnotation } from '../src/model/trace-data'
import type { TraceViewport } from '../src/model/viewport'

const viewport: TraceViewport = {
  startTimeS: 0,
  durationS: 10,
  channelOffset: 0,
  visibleChannelCount: 1,
  gainByType: {},
}

describe('annotation layout', () => {
  it('assigns overlapping ranges to separate lanes and clips recording boundaries', () => {
    const annotations: readonly TraceAnnotation[] = [
      { id: 'before', label: 'Before', startTimeS: -1, durationS: 3 },
      { id: 'overlap', label: 'Overlap', startTimeS: 1, durationS: 3 },
      { id: 'after', label: 'After', startTimeS: 9, durationS: 3 },
    ]

    const layout = layoutAnnotations(annotations, viewport, 1000)
    expect(layout.find(({ annotation }) => annotation.id === 'before')).toMatchObject({
      clippedBefore: true,
      lane: 0,
      startRatio: 0,
    })
    expect(layout.find(({ annotation }) => annotation.id === 'overlap')?.lane).toBe(1)
    expect(layout.find(({ annotation }) => annotation.id === 'after')).toMatchObject({
      clippedAfter: true,
      endRatio: 1,
    })
  })

  it('keeps point events keyboard-targetable while hiding labels that cannot fit', () => {
    const annotations: readonly TraceAnnotation[] = [
      { id: 'event', kind: 'event', label: 'Point event', startTimeS: 5, durationS: 0 },
      { id: 'narrow', label: 'Narrow range', startTimeS: 6, durationS: 0.01 },
    ]

    const layout = layoutAnnotations(annotations, viewport, 500)
    expect(layout.find(({ annotation }) => annotation.id === 'event')).toMatchObject({ startRatio: 0.5, endRatio: 0.5 })
    expect(layout.find(({ annotation }) => annotation.id === 'narrow')?.showLabel).toBe(false)
  })

  it('wraps previous and next annotation navigation deterministically', () => {
    const annotations: readonly TraceAnnotation[] = [
      { id: 'later', label: 'Later', startTimeS: 8, durationS: 0 },
      { id: 'earlier', label: 'Earlier', startTimeS: 2, durationS: 0 },
    ]

    expect(adjacentAnnotation(annotations, 2, 'next')?.id).toBe('later')
    expect(adjacentAnnotation(annotations, 8, 'next')?.id).toBe('earlier')
    expect(adjacentAnnotation(annotations, 2, 'previous')?.id).toBe('later')
  })
})
