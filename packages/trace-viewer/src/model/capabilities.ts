export interface TraceCapabilities {
  canMarkBadChannels: boolean
  canEditAnnotations: boolean
}

export const READ_ONLY_TRACE_CAPABILITIES = {
  canMarkBadChannels: false,
  canEditAnnotations: false,
} as const satisfies TraceCapabilities
