import { createArrayTraceSource, type TraceChannel, type TraceLayer } from '@neurosignal/trace-viewer'

const LABELS = ['Fp1', 'Fp2', 'F7', 'F8', 'C3', 'C4', 'O1', 'O2'] as const

function noise(index: number, channel: number): number {
  return Math.sin(index * 12.9898 + channel * 78.233) * 0.75
}

export function makeLayers(): readonly TraceLayer[] {
  const samplingRateHz = 100
  const sampleCount = 1200
  const timesS = Float64Array.from({ length: sampleCount }, (_, index) => index / samplingRateHz)
  const before: Record<string, Float32Array> = {}
  const after: Record<string, Float32Array> = {}
  const channels: readonly TraceChannel[] = LABELS.map((label, index) => ({
    id: label,
    label,
    type: 'eeg',
    unit: 'µV',
    bad: index === 3,
  }))

  LABELS.forEach((label, channel) => {
    const raw = new Float32Array(sampleCount)
    const clean = new Float32Array(sampleCount)
    for (let index = 0; index < sampleCount; index += 1) {
      const time = index / samplingRateHz
      const baseline = 5.5 * Math.sin(2 * Math.PI * 10 * time + channel * 0.28)
        + 2.2 * Math.sin(2 * Math.PI * 4 * time + channel * 0.43)
        + noise(index, channel)
      const blinkWeight = Math.max(0.08, 1 - channel * 0.13)
      const blink = 64 * blinkWeight * Math.exp(-((time - 5.25) ** 2) / 0.055)
      raw[index] = baseline + blink
      clean[index] = baseline + blink * 0.12
    }
    before[label] = raw
    after[label] = clean
  })

  const common = {
    revision: 'ica-fixture-v1',
    title: 'ICA artifact recovery · planted blink',
    timesS,
    channels,
    annotations: [
      { id: 'calibration', label: 'Calibration settled', startTimeS: 0, durationS: 0.55, kind: 'annotation' as const },
      { id: 'blink-window', label: 'Planted blink window', startTimeS: 4.9, durationS: 0.7, kind: 'annotation' as const },
      { id: 'blink-peak', label: 'Planted blink peak', startTimeS: 5.25, durationS: 0, kind: 'event' as const },
      { id: 'movement', label: 'Movement contamination', startTimeS: 5.15, durationS: 0.22, kind: 'bad-segment' as const },
      { id: 'recording-end', label: 'Review continues past end', startTimeS: 11.7, durationS: 0.45, kind: 'annotation' as const },
    ],
    capabilities: { canMarkBadChannels: true, canEditAnnotations: true },
  }

  return [
    {
      id: 'before',
      label: 'Before · generated EEG',
      color: '#b65f42',
      lineStyle: 'dashed',
      source: createArrayTraceSource({ ...common, sourceId: 'ica-before', series: before }),
    },
    {
      id: 'after',
      label: 'After · cleaned EEG',
      color: '#087f83',
      lineStyle: 'solid',
      source: createArrayTraceSource({ ...common, sourceId: 'ica-after', series: after }),
    },
  ]
}
