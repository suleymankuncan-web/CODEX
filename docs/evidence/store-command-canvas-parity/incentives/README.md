# Incentives Command Canvas parity evidence

Status: `Base geometry parity: PASS`; `overlay semantic/viewport parity: PASS`

This PR does not claim pixel-identical screenshot diffing. Exact full-surface
visual closeout remains a final train gate; the evidence here is bounded to the
versioned base geometry, required overlay structure, responsive containment,
interaction contracts, and human-readable captures listed below.

Production route: `/store/incentives`

Approved reference: `D:\hr-axis-external-lab\prototypes\incentives-command-canvas-v1`

## Captured production states

| Persona | Viewport | Evidence |
| --- | --- | --- |
| Region Manager | 1440x900 | `region-manager-desktop.png` |
| Region Manager | 1024x768 | `region-manager-compact.png` |
| Region Manager | 390x844 | `region-manager-mobile.png` |
| Region Manager | 320x844 | `region-manager-narrow.png` |
| Report Viewer | 1440x900 | `report-viewer-desktop.png` |
| Report Viewer | 1024x768 | `report-viewer-compact.png` |
| Report Viewer | 390x844 | `report-viewer-mobile.png` |
| Report Viewer | 320x844 | `report-viewer-narrow.png` |

The production correction, submission, and audit overlays are captured at
1440x900 and 320x844 in the corresponding `*-desktop.png` and `*-narrow.png`
files. The period picker and active metric state are verified in the same
automated evidence suite without replacing the base-page captures.

## Parity manifest

- Real `StoreShell` and navigation surround the accepted Command Canvas page.
- Header, month/year period control, four-card decision rail, compact command
  bar, Region Manager tabs, store accordions, personnel rows, correction
  drawer, submit confirmation, and Report Viewer hierarchy use the accepted
  structure and interaction order. Base-page landmark geometry is mechanically
  checked; overlay structure is checked semantically and by viewport bounds.
- Production values come from the authorized Incentives workspace response.
- Report Viewer is structurally read-only; its full interaction test records
  zero `POST`, `PUT`, `PATCH`, or `DELETE` Incentives requests.
- Region Manager review, correction, void, and submission retain the existing
  write contracts and optimistic rollback behavior.
- Loading, empty dataset, empty local result, blocking error, partial data,
  unresolved rate metadata, and background refresh are explicit states.
- Desktop, tablet, and mobile verification reports no page-level horizontal
  overflow and no axe violations within the Command Canvas page.
- `prototype-geometry-v1.json` is the versioned approved-reference manifest.
  `store-incentives-parity-evidence.spec.ts` waits for production fonts and
  asserts every recorded base-page landmark within one CSS pixel at all eight
  role/viewport combinations.
- The overlay evidence run uses an isolated preview port so an unrelated local
  Vite process cannot be mistaken for the current worktree build.

## Intentional exclusions

The Labs shell, persona switcher, fixture identities, debug controls, and fake
values are intentionally absent. These are prototype harness elements rather
than production parity requirements. Store Manager Incentives remains hidden
and unavailable as required by the approved plan.
