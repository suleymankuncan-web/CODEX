# Store Ops System Flow

This directory contains the generated system-flow map for the Store Ops
workspace.

Run it from the repository root:

```powershell
npm.cmd run system-flow:generate
```

The generator reads checked-in source only:

- frontend shell routes,
- frontend API client usage,
- backend controller decorators,
- OpenAPI paths.

It writes:

- `store-ops-system-flow.json` for machine-readable analysis,
- `store-ops-system-flow.html` for browser inspection.

This is not live runtime evidence. It does not prove staging health, auth
session behavior, provider setup, database freshness, or queue durability.
Those still require the relevant smoke/evidence runbooks.
