import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TraceViewer } from '../src/components/TraceViewer'
import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'
import type { TraceChannel } from '../src/model/channel'

const channels = ['Fp1', 'Fp2', 'C3'].map((label): TraceChannel => ({ id: label, label, type: 'eeg', unit: 'µV', bad: false }))

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
})
