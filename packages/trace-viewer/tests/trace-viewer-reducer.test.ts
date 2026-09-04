import { describe, expect, it } from 'vitest'

import type { TraceChannel } from '../src/model/channel'
import type { TraceMetadata } from '../src/model/trace-data'
import { READ_ONLY_TRACE_CAPABILITIES } from '../src/model/capabilities'
import {
  constraintsFromMetadata,
  MAXIMUM_GAIN,
  MINIMUM_GAIN,
  normalizeSelection,
  normalizeViewport,
} from '../src/state/invariants'
import {
  createInitialTraceViewerState,
  reduceTraceViewerState,
} from '../src/state/trace-viewer-reducer'

const channels: readonly TraceChannel[] = Array.from({ length: 12 }, (_, index) => ({
  id: `channel-${index}`,
  label: `Channel ${index}`,
  type: index < 10 ? 'eeg' : 'eog',
  unit: 'µV',
  bad: false,
}))

const metadata: TraceMetadata = {
  sourceId: 'reducer-fixture',
  revision: '1',
  startTimeS: 10,
  durationS: 120,
  samplingRateHz: 100,
  channels,
  annotations: [],
  capabilities: READ_ONLY_TRACE_CAPABILITIES,
}

const constraints = constraintsFromMetadata(metadata)

describe('trace viewer invariants', () => {
  it('clamps arbitrary viewport candidates to recording and channel boundaries', () => {
    for (let index = -120; index <= 120; index += 1) {
      const viewport = normalizeViewport({
        startTimeS: index * 3.7,
        durationS: index === 0 ? Number.NaN : Math.abs(index * 1.3),
        channelOffset: index,
        visibleChannelCount: Math.abs(index % 20),
        gainByType: { eeg: index / 3 },
      }, constraints)
      expect(viewport.startTimeS).toBeGreaterThanOrEqual(metadata.startTimeS)
      expect(viewport.startTimeS + viewport.durationS).toBeLessThanOrEqual(metadata.startTimeS + metadata.durationS)
      expect(viewport.durationS).toBeGreaterThanOrEqual(1 / metadata.samplingRateHz)
      expect(viewport.channelOffset).toBeGreaterThanOrEqual(0)
      expect(viewport.channelOffset + viewport.visibleChannelCount).toBeLessThanOrEqual(channels.length)
      expect(viewport.gainByType.eeg).toBeGreaterThanOrEqual(MINIMUM_GAIN)
      expect(viewport.gainByType.eeg).toBeLessThanOrEqual(MAXIMUM_GAIN)
    }
  })

  it('sorts, snaps, and clamps reverse-dragged boundary selections', () => {
    expect(normalizeSelection({ startTimeS: 140, endTimeS: 9.996 }, constraints)).toEqual({
      startTimeS: 10,
      endTimeS: 130,
    })
    expect(normalizeSelection({ startTimeS: 10.001, endTimeS: 10.004 }, constraints)).toBeNull()
  })
})

describe('trace viewer reducer', () => {
  it('keeps repeated navigation, zoom, gain, and channel paging in bounds', () => {
    let state = createInitialTraceViewerState({
      startTimeS: 40,
      durationS: 10,
      channelOffset: 2,
      visibleChannelCount: 4,
      gainByType: {},
    }, constraints)
    const actions = [
      { type: 'pan-time', deltaTimeS: -10_000 },
      { type: 'pan-time', deltaTimeS: 20_000 },
      { type: 'zoom-time', factor: 0.000001 },
      { type: 'zoom-time', factor: 1_000_000 },
      { type: 'shift-channel-offset', delta: 9_999 },
      { type: 'set-visible-channel-count', count: 999 },
      { type: 'scale-gain', factor: 1_000_000 },
    ] as const

    for (const action of actions) state = reduceTraceViewerState(state, action, constraints)
    expect(state.viewport.startTimeS).toBeGreaterThanOrEqual(10)
    expect(state.viewport.startTimeS + state.viewport.durationS).toBeLessThanOrEqual(130)
    expect(state.viewport.channelOffset).toBe(0)
    expect(state.viewport.visibleChannelCount).toBe(12)
    expect(state.viewport.gainByType.eeg).toBe(MAXIMUM_GAIN)
  })

  it('moves focus by stable channel ID and reveals it without mutating the source state', () => {
    const original = createInitialTraceViewerState({
      startTimeS: 10,
      durationS: 10,
      channelOffset: 0,
      visibleChannelCount: 3,
      gainByType: {},
    }, constraints)
    const next = reduceTraceViewerState(original, { type: 'move-channel-focus', delta: 5 }, constraints)
    expect(next.focusedChannelId).toBe('channel-5')
    expect(next.viewport.channelOffset).toBe(3)
    expect(original.focusedChannelId).toBe('channel-0')
    expect(original.viewport.channelOffset).toBe(0)
  })

  it('jumps the cursor and viewport atomically while clamping recording boundaries', () => {
    const original = createInitialTraceViewerState({
      startTimeS: 10,
      durationS: 20,
      channelOffset: 0,
      visibleChannelCount: 3,
      gainByType: {},
    }, constraints)
    const middle = reduceTraceViewerState(original, { type: 'jump-to-time', timeS: 70 }, constraints)
    const end = reduceTraceViewerState(middle, { type: 'jump-to-time', timeS: 130 }, constraints)

    expect(middle.cursor).toEqual({ timeS: 70 })
    expect(middle.viewport.startTimeS).toBe(60)
    expect(end.cursor).toEqual({ timeS: 130 })
    expect(end.viewport.startTimeS).toBe(110)
  })
})
