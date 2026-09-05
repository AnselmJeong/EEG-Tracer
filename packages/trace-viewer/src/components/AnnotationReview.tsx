import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'

import type { TraceAnnotation, TraceAnnotationIntent } from '../model/trace-data'
import type { TraceCursor, TraceSelection } from '../model/selection'

export interface AnnotationReviewHandle {
  openNew: () => void
  openExisting: (annotationIds: readonly string[]) => void
}

export const AnnotationReview = forwardRef<AnnotationReviewHandle, {
  annotations: readonly TraceAnnotation[]
  cursor: TraceCursor | null
  selection: TraceSelection | null
  onIntent: (intent: TraceAnnotationIntent) => void
  announce: (message: string) => void
}>(function AnnotationReview({ annotations, cursor, selection, onIntent }, ref) {
  const [annotationId, setAnnotationId] = useState('')
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [label, setLabel] = useState('')
  const [contextIds, setContextIds] = useState<readonly string[] | null>(null)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const openNew = () => {
    setMode('create')
    setContextIds(null)
    setAnnotationId('')
    setLabel('')
    dialog.current?.showModal()
    input.current?.focus()
  }
  const openExisting = (annotationIds: readonly string[]) => {
    const annotation = annotationIds.length === 1 ? annotations.find(({ id }) => id === annotationIds[0]) : undefined
    setMode('edit')
    setContextIds(annotationIds)
    setAnnotationId(annotation?.id ?? '')
    setLabel(annotation?.label ?? '')
    dialog.current?.showModal()
    if (annotation) input.current?.focus()
  }
  useImperativeHandle(ref, () => ({ openNew, openExisting }))
  const category = annotations.find((annotation) => annotation.id === annotationId)
  const existing = mode === 'edit' ? category : undefined
  const categories = annotations.filter((annotation, index) => annotations.findIndex((other) => (
    other.label === annotation.label && other.kind === annotation.kind
  )) === index)
  const startTimeS = selection?.startTimeS ?? cursor?.timeS
  return <div className="nsv-annotation-review">
    <button type="button" onClick={() => {
      setMode('edit')
      setContextIds(null)
      setAnnotationId(annotations[0]?.id ?? '')
      setLabel(annotations[0]?.label ?? '')
      dialog.current?.showModal()
      input.current?.focus()
    }}>Annotations…</button>
    <span>Right-click a selection to add; an annotation to edit or delete.</span>
    <dialog ref={dialog} className="nsv-annotation-dialog" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{mode === 'edit' ? 'Edit annotation' : selection ? 'Add annotation' : 'Add event'}</h2>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (!label.trim()) return
      if (existing !== undefined) onIntent({ type: 'update', annotation: { ...existing, label: label.trim() } })
      else if (mode === 'create' && startTimeS !== undefined) onIntent({ type: 'create', annotation: {
        label: label.trim(), startTimeS, durationS: selection === null ? 0 : selection.endTimeS - selection.startTimeS,
        kind: selection === null ? 'event' : category?.kind === 'bad-segment' ? 'bad-segment' : 'annotation',
        ...(category?.color === undefined ? {} : { color: category.color }),
      } })
      else return
      dialog.current?.close()
    }}>
      <p>{existing ? `${existing.startTimeS.toFixed(3)}–${(existing.startTimeS + existing.durationS).toFixed(3)} s`
        : mode === 'edit' ? 'Choose the annotation to edit or delete.'
        : selection ? `${selection.startTimeS.toFixed(3)}–${selection.endTimeS.toFixed(3)} s`
          : cursor ? `${cursor.timeS.toFixed(3)} s` : 'Select a range or click the trace first.'}</p>
      {contextIds?.length === 1 ? null : <>
      <label htmlFor={`${id}-target`}>{mode === 'create' ? 'Category' : 'Annotation'}</label>
      <select id={`${id}-target`} value={annotationId} onChange={(event) => {
        setAnnotationId(event.target.value)
        setLabel(annotations.find((annotation) => annotation.id === event.target.value)?.label ?? '')
      }}>
        <option value="">{mode === 'create' ? 'New category' : 'Choose annotation'}</option>
        {(mode === 'create' ? categories : annotations.filter(({ id }) => contextIds === null || contextIds.includes(id))).map((annotation) => <option key={annotation.id} value={annotation.id}>
          {mode === 'create' ? annotation.label : `${annotation.label} · ${annotation.startTimeS.toFixed(3)}–${(annotation.startTimeS + annotation.durationS).toFixed(3)} s`}
        </option>)}
      </select>
      </>}
      <label htmlFor={`${id}-label`}>Annotation label</label>
      <input ref={input} id={`${id}-label`} value={label} maxLength={500} onChange={(event) => setLabel(event.target.value)} />
      <button type="submit" disabled={!label.trim() || (mode === 'edit' ? !existing : startTimeS === undefined)}>
        {mode === 'edit' ? 'Save changes' : selection ? 'Add annotation' : 'Add event'}
      </button>
      {existing !== undefined ? <button type="button" onClick={() => {
        onIntent({ type: 'delete', annotationId: existing.id })
        dialog.current?.close()
      }}>Delete annotation</button> : null}
      <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
    </form>
    </dialog>
  </div>
})
