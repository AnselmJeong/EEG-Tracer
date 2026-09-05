import type { CSSProperties } from 'react'

import type { TraceRenderModel } from '../renderers/TraceRenderer'
import type { TraceViewerAction, TraceViewerInteractionState } from '../state/trace-viewer-reducer'

interface ChannelNavigatorProps {
  announce: (message: string) => void
  canMarkBadChannels: boolean
  dispatch: (action: TraceViewerAction) => void
  model: TraceRenderModel
  onBadChannelIntent: ((channelId: string, bad: boolean) => void) | undefined
  state: TraceViewerInteractionState
}

export function ChannelNavigator({ announce, canMarkBadChannels, dispatch, model, onBadChannelIntent, state }: ChannelNavigatorProps) {
  return (
    <div
      aria-label="Visible channels"
      className="nsv-channel-navigator"
      style={{
        '--nsv-channel-label-width': `${model.geometry.left}px`,
        '--nsv-channel-row-height': `${model.geometry.rowHeight}px`,
        top: model.geometry.top,
      } as CSSProperties}
    >
      {model.channels.map((channel) => {
        const focused = state.focusedChannelId === channel.id
        const selected = state.selectedChannelIds.includes(channel.id)
        return (
          <div className="nsv-channel-row" key={channel.id}>
            <button
              aria-label={`${channel.label}, ${channel.type.toUpperCase()}, ${channel.unit}${channel.bad ? ', bad channel' : ''}`}
              aria-pressed={selected}
              className={['nsv-channel-select', focused ? 'is-focused' : '', selected ? 'is-selected' : '', channel.bad ? 'is-bad' : ''].filter(Boolean).join(' ')}
              onClick={() => dispatch({ type: 'toggle-channel-selection', channelId: channel.id })}
              type="button"
            >
              <strong>{channel.label}</strong>
              <small>{channel.unit}{channel.bad ? ' · BAD' : ''}</small>
            </button>
            {canMarkBadChannels && onBadChannelIntent !== undefined ? (
              <button
                aria-label={`${channel.bad ? 'Restore' : 'Mark'} ${channel.label} ${channel.bad ? 'as good' : 'as bad'}`}
                aria-pressed={channel.bad}
                className="nsv-bad-channel-intent"
                onClick={() => {
                  onBadChannelIntent(channel.id, !channel.bad)
                  announce(`${channel.label}: ${channel.bad ? 'restore good status' : 'mark as bad'}.`)
                }}
                title={channel.bad ? 'Restore good status' : 'Mark as bad'}
                type="button"
              >
                {channel.bad ? '✓' : '!'}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
