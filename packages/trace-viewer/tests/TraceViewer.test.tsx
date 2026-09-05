import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TraceViewer } from '../src/components/TraceViewer'
import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'
import type { TraceChannel } from '../src/model/channel'
import type { TraceWindowRequest } from '../src/model/trace-data'

const channels = ['Fp1', 'Fp2', 'C3'].map((label): TraceChannel => ({ id: label, label, type: 'eeg', unit: 'µV', bad: false }))

it('suspends hidden-tab prefetch and retains old trace coordinates until new data arrives', async () => {
  const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  try {
    const original = contextSource('slow')
    let release: () => void = () => { throw new Error('No pending request') }
    const getWindow = vi.fn(async (request: TraceWindowRequest, signal?: AbortSignal) => {
      if (request.startTimeS === 2) await new Promise<void>((resolve) => { release = resolve })
      return original.getWindow(request, signal)
    })
    const { container } = render(<TraceViewer ariaLabel="Slow EEG" defaultViewport={{ durationS: 2 }}
      layers={[{ id: 'slow', label: 'Source', source: { ...original, getWindow } }]} renderer="svg" />)
    const plot = await screen.findByRole('img', { name: 'Slow EEG' })
    await act(() => new Promise((resolve) => setTimeout(resolve, 240)))
    expect(getWindow).toHaveBeenCalledTimes(1)
    const oldPath = plot.querySelector('[data-layer]')?.getAttribute('d')
    fireEvent.change(screen.getByRole('slider', { name: 'Time position' }), { target: { value: '2' } })
    expect(container.querySelector('.nsv-stage')).toHaveAttribute('aria-busy', 'true')
    expect(plot.querySelector('[data-layer]')?.getAttribute('d')).toBe(oldPath)
    await act(async () => { release(); await Promise.resolve() })
    await waitFor(() => expect(container.querySelector('.nsv-stage')).toHaveAttribute('aria-busy', 'false'))
    expect(plot.querySelector('[data-layer]')?.getAttribute('d')).not.toBe(oldPath)
  } finally { visibility.mockRestore() }
})

it('reuses an adjacent prefetched viewport and does not refetch for gain', async () => {
  const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  try {
    const original = contextSource('prefetch')
    const getWindow = vi.fn((request: TraceWindowRequest, signal?: AbortSignal) => original.getWindow(request, signal))
    render(<TraceViewer ariaLabel="Prefetched EEG" defaultViewport={{ durationS: 2, visibleChannelCount: 2 }}
      layers={[{ id: 'prefetch', label: 'Source', source: { ...original, getWindow } }]} renderer="svg" />)
    await screen.findByRole('img', { name: 'Prefetched EEG' })
    await waitFor(() => expect(getWindow.mock.calls.some(([request]) => request.startTimeS === 2)).toBe(true))
    fireEvent.change(screen.getByRole('slider', { name: 'Time position' }), { target: { value: '2' } })
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Time position' })).toHaveValue('2'))
    fireEvent.click(screen.getByRole('button', { name: 'Increase amplitude gain' }))
    expect(getWindow.mock.calls.filter(([request]) => request.startTimeS === 2)).toHaveLength(1)
    expect(getWindow.mock.calls.every(([request]) => request.channelIds.length === 2)).toBe(true)
  } finally { visibility.mockRestore() }
})

function source(id: string, multiplier = 1, unit = 'µV') {
  return createArrayTraceSource({
    sourceId: id,
    title: 'Testbed EEG',
    timesS: [0, 0.5, 1],
    channels: channels.map((channel) => ({ ...channel, unit })),
    series: {
      Fp1: [0, 3 * multiplier, 0],
      Fp2: [0, 2 * multiplier, 0],
      C3: [0, 1 * multiplier, 0],
    },
  })
}

function contextSource(id: string, canMarkBadChannels = true) {
  return createArrayTraceSource({
    annotations: [
      { id: 'review', label: 'Reviewed segment', startTimeS: 0, durationS: 1.2 },
      { id: 'bad', kind: 'bad-segment', label: 'Movement contamination', startTimeS: 0.4, durationS: 0.5 },
      { id: 'narrow', label: 'Narrow context', startTimeS: 0.5, durationS: 0.01 },
      { id: 'late', kind: 'event', label: 'Late spike', startTimeS: 8, durationS: 0 },
      { id: 'boundary', label: 'Recording end context', startTimeS: 9.8, durationS: 2 },
    ],
    capabilities: { canMarkBadChannels },
    channels,
    series: {
      Fp1: Array.from({ length: 11 }, (_, index) => index),
      Fp2: Array.from({ length: 11 }, (_, index) => index * 0.5),
      C3: Array.from({ length: 11 }, (_, index) => -index),
    },
    sourceId: id,
    timesS: Array.from({ length: 11 }, (_, index) => index),
  })
}

describe('TraceViewer', () => {
  it('renders every channel and two layers on a shared SVG plot', async () => {
    render(<TraceViewer ariaLabel="Three-channel ICA comparison" layers={[
      { id: 'before', label: 'Before', source: source('before'), lineStyle: 'dashed' },
      { id: 'after', label: 'After', source: source('after', 0.5), lineStyle: 'solid' },
    ]} renderer="svg" />)

    const plot = await screen.findByRole('img', { name: 'Three-channel ICA comparison' })
    channels.forEach(({ label }) => expect(within(plot).getByText(label)).toBeVisible())
    expect(screen.getByText('Before')).toBeVisible()
    expect(screen.getByText('After')).toBeVisible()
    expect(screen.getByText('LOCKED SCALE')).toBeVisible()
    expect(plot.querySelectorAll('[data-layer="before"]')).toHaveLength(3)
    expect(plot.querySelectorAll('[data-layer="after"]')).toHaveLength(3)
  })

  it('shows an explicit error when layer units are incompatible', async () => {
    render(<TraceViewer ariaLabel="Invalid comparison" layers={[
      { id: 'microvolts', label: 'Microvolts', source: source('uv') },
      { id: 'volts', label: 'Volts', source: source('v', 1, 'V') },
    ]} renderer="svg" />)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('uses both µV and V'))
    expect(screen.queryByRole('img', { name: 'Invalid comparison' })).not.toBeInTheDocument()
  })

  it('does not connect an SVG path across a NaN gap', async () => {
    const gapSource = createArrayTraceSource({
      sourceId: 'gap',
      timesS: [0, 0.25, 0.5, 0.75, 1],
      series: { Cz: [0, 2, Number.NaN, -2, 0] },
    })
    render(<TraceViewer ariaLabel="Gap trace" layers={[{ id: 'gap', label: 'Gap', source: gapSource }]} renderer="svg" />)
    const plot = await screen.findByRole('img', { name: 'Gap trace' })
    const path = plot.querySelector('[data-layer="gap"]')
    expect(path?.getAttribute('d')?.match(/M/g)).toHaveLength(2)
  })

  it('emits keyboard navigation and gain changes from an uncontrolled viewport', async () => {
    const onViewportChange = vi.fn()
    const onSelectedChannelIdsChange = vi.fn()
    render(
      <TraceViewer
        ariaLabel="Keyboard trace"
        defaultViewport={{ durationS: 0.5, visibleChannelCount: 2 }}
        layers={[{ id: 'signal', label: 'Signal', source: source('keyboard') }]}
        onSelectedChannelIdsChange={onSelectedChannelIdsChange}
        onViewportChange={onViewportChange}
        renderer="svg"
      />,
    )

    const surface = await screen.findByRole('application', { name: 'Interactive trace viewport' })
    fireEvent.keyDown(surface, { key: 'ArrowRight' })
    expect(onViewportChange).toHaveBeenLastCalledWith(expect.objectContaining({ startTimeS: 0.05, durationS: 0.5 }))

    fireEvent.keyDown(surface, { key: '+' })
    expect(onViewportChange).toHaveBeenLastCalledWith(expect.objectContaining({ gainByType: { eeg: 2 } }))

    fireEvent.keyDown(surface, { key: 'Enter' })
    expect(onSelectedChannelIdsChange).toHaveBeenLastCalledWith(['Fp1'])
  })

  it('keeps a controlled viewport fixed while emitting the requested next state', async () => {
    const onViewportChange = vi.fn()
    render(
      <TraceViewer
        ariaLabel="Controlled trace"
        layers={[{ id: 'signal', label: 'Signal', source: source('controlled') }]}
        onViewportChange={onViewportChange}
        renderer="svg"
        viewport={{ startTimeS: 0, durationS: 0.5, channelOffset: 0, visibleChannelCount: 2, gainByType: {} }}
      />,
    )

    const surface = await screen.findByRole('application', { name: 'Interactive trace viewport' })
    fireEvent.keyDown(surface, { key: 'ArrowRight' })
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ startTimeS: 0.05 }))
    expect(screen.getByRole('slider', { name: 'Time position' })).toHaveValue('0')
  })

  it('maps pointer clicks and reverse drags to snapped cursor and selection callbacks', async () => {
    const onCursorChange = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <TraceViewer
        ariaLabel="Pointer trace"
        layers={[{ id: 'signal', label: 'Signal', source: source('pointer') }]}
        onCursorChange={onCursorChange}
        onSelectionChange={onSelectionChange}
        renderer="svg"
      />,
    )
    const surface = await screen.findByRole('application', { name: 'Interactive trace viewport' })
    surface.getBoundingClientRect = () => ({
      bottom: 300,
      height: 300,
      left: 100,
      right: 900,
      top: 0,
      width: 800,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(surface, { button: 0, clientX: 500, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 500, clientY: 100, pointerId: 1 })
    expect(onCursorChange).toHaveBeenLastCalledWith({ timeS: 1, channelId: 'Fp2' })

    fireEvent.pointerDown(surface, { button: 0, clientX: 800, clientY: 100, pointerId: 2 })
    fireEvent.pointerMove(surface, { button: 0, clientX: 200, clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 200, clientY: 100, pointerId: 2 })
    expect(onSelectionChange).toHaveBeenLastCalledWith({ startTimeS: 0, endTimeS: 1.5 })
  })

  it('can preserve the Phase 1 static surface behind the interaction feature flag', async () => {
    render(<TraceViewer ariaLabel="Static trace" interactive={false} layers={[{ id: 'signal', label: 'Signal', source: source('static') }]} renderer="svg" />)
    expect(await screen.findByRole('img', { name: 'Static trace' })).toBeVisible()
    expect(screen.queryByRole('application')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zoom in in time' })).not.toBeInTheDocument()
  })

  it('lays out semantic annotation lanes, hides cramped labels, and filters by kind', async () => {
    render(
      <TraceViewer
        ariaLabel="Context trace"
        defaultViewport={{ durationS: 2 }}
        layers={[{ id: 'signal', label: 'Signal', source: contextSource('context') }]}
        renderer="svg"
      />,
    )

    const lane = await screen.findByRole('list', { name: 'Visible annotations and events' })
    expect(within(lane).getByRole('button', { name: /Narrow context/ })).toBeVisible()
    expect(within(lane).queryByText('Narrow context')).not.toBeInTheDocument()
    expect(within(lane).getAllByText('ANN').length).toBeGreaterThan(0)
    expect(within(lane).getByText('BAD')).toBeVisible()

    expect(screen.getByRole('button', { name: /Jump to event Late spike/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Show event overlays' }))
    expect(screen.queryByRole('button', { name: /Jump to event Late spike/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show event overlays' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('jumps to events from toolbar and overview keyboard navigation', async () => {
    const onCursorChange = vi.fn()
    const onViewportChange = vi.fn()
    render(
      <TraceViewer
        ariaLabel="Jump trace"
        defaultViewport={{ durationS: 2 }}
        layers={[{ id: 'signal', label: 'Signal', source: contextSource('jump') }]}
        onCursorChange={onCursorChange}
        onViewportChange={onViewportChange}
        renderer="svg"
      />,
    )

    await screen.findByRole('group', { name: 'Recording overview' })
    fireEvent.click(screen.getByRole('button', { name: 'Show annotation overlays' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show bad-segment overlays' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jump to next visible annotation or event' }))
    expect(onCursorChange).toHaveBeenLastCalledWith({ timeS: 8 })
    expect(onViewportChange).toHaveBeenLastCalledWith(expect.objectContaining({ startTimeS: 7 }))

    const overview = screen.getByRole('slider', { name: /Recording overview, visible window/ })
    fireEvent.keyDown(overview, { key: 'End' })
    expect(onViewportChange).toHaveBeenLastCalledWith(expect.objectContaining({ startTimeS: 9 }))
  })

  it('emits bad-channel intent without mutating source metadata and honors read-only gates', async () => {
    const onBadChannelIntent = vi.fn()
    const { rerender } = render(
      <TraceViewer
        ariaLabel="Read-only review"
        layers={[{ id: 'signal', label: 'Signal', source: contextSource('review-gate') }]}
        onBadChannelIntent={onBadChannelIntent}
        renderer="svg"
      />,
    )

    await screen.findByRole('img', { name: 'Read-only review' })
    expect(screen.queryByRole('button', { name: 'Mark Fp1 as bad' })).not.toBeInTheDocument()

    rerender(
      <TraceViewer
        ariaLabel="Intent-enabled review"
        layers={[{ id: 'signal', label: 'Signal', source: contextSource('review-enabled') }]}
        onBadChannelIntent={onBadChannelIntent}
        readOnly={false}
        renderer="svg"
      />,
    )
    const intent = await screen.findByRole('button', { name: 'Mark Fp1 as bad' })
    fireEvent.click(intent)
    expect(onBadChannelIntent).toHaveBeenCalledWith('Fp1', true)
    expect(screen.getByRole('button', { name: 'Fp1, EEG, µV' })).not.toHaveAccessibleName(/bad channel/)
    expect(screen.getByText('Fp1: mark as bad.')).toBeInTheDocument()

    rerender(
      <TraceViewer
        ariaLabel="Capability-disabled review"
        layers={[{ id: 'signal', label: 'Signal', source: contextSource('capability-disabled', false) }]}
        onBadChannelIntent={onBadChannelIntent}
        readOnly={false}
        renderer="svg"
      />,
    )
    await screen.findByRole('img', { name: 'Capability-disabled review' })
    expect(screen.queryByRole('button', { name: 'Mark Fp1 as bad' })).not.toBeInTheDocument()
    expect(screen.getByText('READ ONLY')).toBeVisible()
  })

  it('supports an explicit included-channel set independently from channel selection', async () => {
    render(
      <TraceViewer
        ariaLabel="Picked channels"
        includedChannelIds={['C3']}
        layers={[{ id: 'signal', label: 'Signal', source: source('picked') }]}
        renderer="svg"
      />,
    )

    expect(await screen.findByRole('button', { name: 'C3, EEG, µV' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Fp1, EEG, µV' })).not.toBeInTheDocument()
    expect(screen.getByText('1–1 / 1', { exact: true })).toBeVisible()
  })
})
