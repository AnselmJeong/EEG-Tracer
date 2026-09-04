# Accessibility contract

- `TraceViewer` requires a non-empty `ariaLabel`.
- The plot has an image role while channel metadata, layer visibility, units, bad-channel state,
  visible time span, and data representation are duplicated in semantic DOM text.
- Color is supplemented by solid/dashed/dotted line styles and text labels.
- Loading, error, and unavailable states use status or alert semantics.
- The package does not register global keyboard shortcuts in Phase 1.
- Forced-colors and reduced-motion modes are covered by package CSS.
