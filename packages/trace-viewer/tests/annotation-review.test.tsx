import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { TraceViewer } from '../src/components/TraceViewer'
import { createArrayTraceSource } from '../src/data-source/createArrayTraceSource'

// jsdom does not implement the native modal-dialog methods.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

it('gates editing by capability/read-only and emits create, rename, delete without changing the source', async () => {
  const onAnnotationIntent = vi.fn()
  const source = createArrayTraceSource({ sourceId: 'review', timesS: [0, 1, 2], series: { Cz: [1, 2, 3] },
    annotations: [{ id: 'a', label: 'Original', startTimeS: 1, durationS: 0 }], capabilities: { canEditAnnotations: true } })
  const layers = [{ id: 'a', label: 'Source', source }]
  const props = { ariaLabel: 'Editable annotation source', layers, onAnnotationIntent, renderer: 'svg' as const,
    defaultSelection: { startTimeS: 0, endTimeS: 1 } }
  const { rerender } = render(<TraceViewer {...props} />)
  await screen.findByRole('img', { name: props.ariaLabel })
  expect(screen.queryByText('Annotations…')).not.toBeInTheDocument()
  fireEvent.contextMenu(screen.getByTestId('trace-interaction-surface'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  rerender(<TraceViewer {...props} readOnly={false} />)
  await screen.findByText('Annotations…')
  vi.spyOn(screen.getByTestId('trace-interaction-surface'), 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 780, bottom: 300, width: 780, height: 300, toJSON: () => ({}),
  })
  fireEvent.contextMenu(screen.getByTestId('trace-interaction-surface'))
  expect(screen.getByRole('dialog', { name: 'Add annotation' })).toBeVisible()
  fireEvent.change(screen.getByLabelText('Annotation label'), { target: { value: 'Candidate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'create', annotation: {
    label: 'Candidate', startTimeS: 0, durationS: 1, kind: 'annotation',
  } })
  fireEvent.contextMenu(screen.getByTestId('trace-interaction-surface'))
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'a' } })
  expect(screen.getByRole('dialog', { name: 'Add annotation' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Delete annotation' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'create', annotation: {
    label: 'Original', startTimeS: 0, durationS: 1, kind: 'annotation',
  } })
  fireEvent.click(screen.getByText('Annotations…'))
  fireEvent.change(screen.getByLabelText('Annotation'), { target: { value: 'a' } })
  fireEvent.change(screen.getByLabelText('Annotation label'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'update', annotation: {
    id: 'a', label: 'Renamed', startTimeS: 1, durationS: 0,
  } })
  fireEvent.click(screen.getByText('Annotations…'))
  fireEvent.change(screen.getByLabelText('Annotation'), { target: { value: 'a' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete annotation' }))
  expect(onAnnotationIntent).toHaveBeenLastCalledWith({ type: 'delete', annotationId: 'a' })
  expect((await source.getMetadata()).annotations[0]?.label).toBe('Original')
})
