# Phase 5: imported FIF integration

The sibling `Neurosignal-Testbed` contains `real_data/trace.py`, `RealDataTraceSource.ts`, and
`RealDataTracePanel.tsx`. The Real data lab displays the viewer after an imported working copy is
ready. Import evidence remains available in a disclosure above the trace; QC and report controls
remain available. The original simulation ICA viewer is unchanged.

The web app installs `apps/web/vendor/neurosignal-trace-viewer-0.4.0.tgz`; this artifact is portable
with the Testbed checkout. No symlink, absolute dependency path, or workspace source import is used.
Build the package before creating/replacing this tarball, then install it in Testbed's web directory.

## Transport

- `GET /real-data/projects/{project_id}/trace-metadata` returns the backend-neutral metadata shape.
- `GET /real-data/projects/{project_id}/trace-window` takes `source_revision`, `start_s`, `duration_s`,
  repeated `channels=ch-N` parameters, `pixel_width`, and `representation=auto|points|min-max`.
- Only the project's imported `recording_raw.fif` is opened with `preload=False`; no source-path
  parameter, scientific processing, file save, or metadata migration runs in these GET endpoints.
- `Raw.get_data(start, stop, picks)` reads half-open sample windows. Times are seconds relative to
  the recording start; annotations subtract `raw.first_time`, including nonzero `first_samp` FIFs.
- Units come from FIF metadata and values remain in MNE's SI units. JSON `null` represents an
  unavailable value and is explicitly restored to `NaN`, not zero, in the adapter.
- Limits: 128 requested channels, 2,400 pixels, up to 2×pixel-width points/channel, and a 64-million
  selected-value scan budget/request. Envelopes read at most 262,144 selected values per chunk.
  Oversized point requests or scans report 422 with instructions to zoom/select fewer channels.
- Revision is a fingerprint of size/mtime/ctime for every FIF part. Changes return 409, and
  **Refresh traces** reloads metadata and clears viewer state/cache. This token is not a content hash;
  original/working-copy SHA-256 preservation is verified separately in tests.
- The integration is read-only; capability flags cannot enable writes from an HTTP response.

## Verification

From this repository:

```sh
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
npm run check:pack
npm run check:consumer
npm run check:real-data
```

`check:real-data` requires the sibling Testbed's `.venv` and installed web dependencies. Override
`NSV_TESTBED_PATH` for a different checkout. It starts temporary servers on 8012/5174 (refusing occupied
ports), creates a deterministic 16-channel FIF in a temporary folder, uses the actual import UI,
checks paging/time navigation and file hashes, saves a screenshot, then stops its servers.
The temporary fixture, derivative, and screenshot path are printed for inspection; no existing
user recording or saved project is opened by this test.

From Testbed:

```sh
.venv/bin/python -m pytest tests/oracle/test_trace_window.py tests/oracle/test_real_data_workflow.py
cd apps/web
npm test
npm run build
```

The MNE oracle compares all point values and every envelope bucket, including narrow positive and
negative peaks, channel reorderings, nonzero sample origins, annotation placement, and untouched
original/working-copy/manifest hashes. Additional checks cover chunk bounds, invalid requests,
revision changes, malformed transport arrays, cancellation, and the installed package's harness.

## Rollback

Remove the `RealDataTracePanel` entry in `RealDataWorkbench` to return to metadata/QC/report-only
review. The endpoints are read-only and create no migration dependency. Keeping the package's
`renderer="svg"` option also permits renderer fallback without changing the data-source contract.
