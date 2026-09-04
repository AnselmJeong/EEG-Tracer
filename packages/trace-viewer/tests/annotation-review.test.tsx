import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { TraceViewer } from '../src/components/TraceViewer'
import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'

it('gates editing by capability/read-only and emits create, rename, delete without changing the source', async () => {
  const onAnnotationIntent = vi.fn()
  const source = createArrayTraceSource({ sourceId: 'review', timesS: [0, 1, 2], series: { Cz: [1, 2, 3] },
    annotations: [{ id: 'a', label: 'Original', startTimeS: 1, durationS: 0 }], capabilities: { canEditAnnotations: true } })
  const layers = [{ id: 'a', label: 'Source', source }]
  const props = { ariaLabel: 'Editable annotation source', layers, onAnnotationIntent, renderer: 'svg' as const,
    defaultSelection: { startTimeS: 0, endTimeS: 1 } }
  const { rerender } = render(<TraceViewer {...props} />)
  await screen.findByRole('img', { name: props.ariaLabel })
  expect(screen.queryByText('Request annotation changes')).not.toBeInTheDocument()
  rerender(<TraceViewer {...props} readOnly={false} />)
  fireEvent.click(await screen.findByText('Request annotation changes'))
  fireEvent.change(screen.getByLabelText('Annotation label'), { target: { value: 'Candidate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Request new annotation' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'create', annotation: {
    label: 'Candidate', startTimeS: 0, durationS: 1, kind: 'annotation',
  } })
  fireEvent.change(screen.getByLabelText('Review annotation'), { target: { value: 'a' } })
  fireEvent.change(screen.getByLabelText('Annotation label'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Request annotation rename' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'update', annotation: {
    id: 'a', label: 'Renamed', startTimeS: 1, durationS: 0,
  } })
  fireEvent.click(screen.getByRole('button', { name: 'Request annotation deletion' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'delete', annotationId: 'a' })
  expect((await source.getMetadata()).annotations[0]?.label).toBe('Original')
})
