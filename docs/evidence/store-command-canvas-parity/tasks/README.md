# Tasks Command Canvas parity evidence

Status: **PASS_LOCAL**; final staging recertification pending

## Locked prototype references

- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\tasks-1440.png`
- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\tasks-1024.png`
- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\tasks-390.png`
- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\tasks-320.png`
- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\task-drawer-1440.png`
- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1\screenshots\decision-rail\task-drawer-390.png`

## Production evidence

- `store-manager-desktop.png` — 1440×900
- `store-manager-compact.png` — 1024×768
- `store-manager-mobile.png` — 390×844
- `store-manager-narrow.png` — 320×844
- `task-drawer-desktop.png` — 1440×900
- `task-drawer-mobile.png` — 390×844
- `region-manager-desktop.png` — result-only regional scope
- `report-viewer-desktop.png` — result-only company scope

The deterministic evidence suite is
`admin-web/e2e/store-tasks-parity-evidence.spec.ts`. It checks the shared
Command Canvas frame, four-card decision rail, sortable result headings,
mobile overflow, operational drawer, sanitized audit trail and role-specific
read-only boundaries. It records all four rail rectangles before and after
every selection and rejects any width or height change at the same viewport.

## Deliberate production boundaries

- Prototype role switching and example data are not shipped.
- Store Manager commands use the real action-plan APIs.
- Region Manager and Report Viewer remain result-only and read-only.
- Results and audit events use bounded server paging; no fixed-size client
  fetch is treated as complete.
- Source links are restricted to the approved Checklist and KPI routes.
