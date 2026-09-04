# Accessibility contract

- `TraceViewer` requires a non-empty `ariaLabel`.
- The plot has an image role while channel metadata, layer visibility, units, bad-channel state,
  visible time span, and data representation are duplicated in semantic DOM text.
- Color is supplemented by solid/dashed/dotted line styles and text labels.
- Loading, error, and unavailable states use status or alert semantics.
- Interactive shortcuts are scoped to the focusable trace viewport; the package does not register
  global keyboard shortcuts or intercept keys from editable controls and IME composition.
- Arrow keys navigate time and focused channels, Page Up/Down pages channels, Enter toggles the
  focused channel, Escape clears a segment, and Alt with plus/minus changes time zoom.
- Cursor time/value, selection bounds, selected-channel count, and interaction instructions are
  available as DOM text outside the Canvas. Pointer commits are announced through a polite live region.
- Annotation, event, and bad-segment kinds use visible text labels and distinct borders/patterns in
  addition to color. Labels that do not fit remain available as button names and semantic detail text.
- Context chips and full-duration overview markers are native buttons. The overview supports arrow,
  Home, and End keys; previous/next context controls remain in the normal toolbar focus order.
- Bad-channel review controls appear only when read-only mode is disabled and every visible source
  advertises the capability. The current bad state remains textual and does not change on intent alone.
- Forced-colors and reduced-motion modes are covered by package CSS.
