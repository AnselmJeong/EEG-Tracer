import { createArrayTraceSource } from '../data-source/createArrayTraceSource'
import type { TraceChannel } from '../model/channel'
import type { TraceLayer } from '../model/viewer'

const CHANNEL_LABELS = ['Fp1', 'Fp2', 'F7', 'F8', 'C3', 'C4', 'O1', 'O2'] as const

export interface IcaTraceFixture {
  timesS: Float64Array
  before: Readonly<Record<string, Float32Array>>
  after: Readonly<Record<string, Float32Array>>
  channels: readonly TraceChannel[]
}

function deterministicNoise(index: number, channel: number): number {
  return Math.sin(index * 12.9898 + channel * 78.233) * 0.75
}

export function createIcaTraceFixture(): IcaTraceFixture {
  const samplingRateHz = 100
  const durationS = 12
  const sampleCount = samplingRateHz * durationS
  const timesS = Float64Array.from({ length: sampleCount }, (_, index) => index / samplingRateHz)
  const before: Record<string, Float32Array> = {}
  const after: Record<string, Float32Array> = {}

  CHANNEL_LABELS.forEach((label, channelIndex) => {
    const frontalWeight = Math.max(0.08, 1 - channelIndex * 0.13)
    const raw = new Float32Array(sampleCount)
    const clean = new Float32Array(sampleCount)
    for (let index = 0; index < sampleCount; index += 1) {
      const time = index / samplingRateHz
      const eeg = 5.5 * Math.sin(2 * Math.PI * 10 * time + channelIndex * 0.28)
        + 2.2 * Math.sin(2 * Math.PI * 4 * time + channelIndex * 0.43)
        + deterministicNoise(index, channelIndex)
      const blink = 64 * frontalWeight * Math.exp(-((time - 5.25) ** 2) / 0.055)
      raw[index] = eeg + blink
      clean[index] = eeg + blink * 0.12
    }
    before[label] = raw
    after[label] = clean
  })

  return {
    timesS,
    before,
    after,
    channels: CHANNEL_LABELS.map((label) => ({ id: label, label, type: 'eeg', unit: 'µV', bad: false })),
  }
}

export function createIcaTraceLayers(): readonly TraceLayer[] {
  const fixture = createIcaTraceFixture()
  return [
    {
      id: 'before',
      label: 'Before · generated EEG',
      color: '#ba6547',
      lineStyle: 'dashed',
      source: createArrayTraceSource({
        sourceId: 'ica-before', revision: 'fixture-v1', title: 'ICA repair comparison',
        timesS: fixture.timesS, series: fixture.before, channels: fixture.channels,
      }),
    },
    {
      id: 'after',
      label: 'After · cleaned EEG',
      color: '#087f83',
      lineStyle: 'solid',
      source: createArrayTraceSource({
        sourceId: 'ica-after', revision: 'fixture-v1', title: 'ICA repair comparison',
        timesS: fixture.timesS, series: fixture.after, channels: fixture.channels,
      }),
    },
  ]
}
