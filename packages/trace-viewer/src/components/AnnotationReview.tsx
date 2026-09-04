import { useId, useState } from 'react'

import type { TraceAnnotation, TraceAnnotationIntent } from '../model/trace-data'
import type { TraceCursor, TraceSelection } from '../model/selection'

/** Intent-only form; displayed annotations change only when the data owner refreshes metadata. */
export function AnnotationReview({ annotations, cursor, selection, onIntent, announce }: {
  annotations: readonly TraceAnnotation[]
  cursor: TraceCursor | null
  selection: TraceSelection | null
  onIntent: (intent: TraceAnnotationIntent) => void
  announce: (message: string) => void
}) {
  const [annotationId, setAnnotationId] = useState('')
  const [label, setLabel] = useState('')
  const id = useId()
  const existing = annotations.find((annotation) => annotation.id === annotationId)
  const startTimeS = selection?.startTimeS ?? cursor?.timeS
  return <details className="nsv-annotation-review">
    <summary>Request annotation changes</summary>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (!label.trim()) return
      if (existing !== undefined) onIntent({ type: 'update', annotation: { ...existing, label: label.trim() } })
      else if (startTimeS !== undefined) onIntent({ type: 'create', annotation: {
        label: label.trim(), startTimeS, durationS: selection === null ? 0 : selection.endTimeS - selection.startTimeS,
        kind: selection === null ? 'event' : 'annotation',
      } })
      else return
      announce('Annotation change requested. Waiting for the data owner to confirm.')
    }}>
      <label htmlFor={`${id}-target`}>Review annotation</label>
      <select id={`${id}-target`} value={annotationId} onChange={(event) => {
        setAnnotationId(event.target.value)
        setLabel(annotations.find((annotation) => annotation.id === event.target.value)?.label ?? '')
      }}>
        <option value="">New from selection or cursor</option>
        {annotations.map((annotation) => <option key={annotation.id} value={annotation.id}>{annotation.label}</option>)}
      </select>
      <label htmlFor={`${id}-label`}>Annotation label</label>
      <input id={`${id}-label`} value={label} maxLength={500} onChange={(event) => setLabel(event.target.value)} />
      <button type="submit" disabled={!label.trim() || (existing === undefined && startTimeS === undefined)}>
        {existing === undefined ? 'Request new annotation' : 'Request annotation rename'}
      </button>
      {existing !== undefined ? <button type="button" onClick={() => {
        onIntent({ type: 'delete', annotationId: existing.id })
        announce('Annotation deletion requested. Waiting for the data owner to confirm.')
      }}>Request annotation deletion</button> : null}
    </form>
  </details>
}
