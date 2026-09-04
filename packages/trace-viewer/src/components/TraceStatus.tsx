export function TraceStatus({ kind, message }: { kind: 'loading' | 'error' | 'empty'; message: string }) {
  return (
    <div className={`nsv-status nsv-status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true" className="nsv-status-mark" />
      <p>{message}</p>
    </div>
  )
}
