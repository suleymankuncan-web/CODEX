# 2026-05-08 Render Free Plan Migration Deploy Evidence

## Scope

This evidence records the staging deploy that aligned Render Free plan migration execution with the current deployment path after scoped security hardening.

It does not approve broad production rollout.

## Git And Deploy

- Security scope hardening reached `main` through PR #70: `725aef74`.
- Render free-plan migration command reached `main` through PR #71: `eafbb53a`.
- Render backend was deployed from the latest `main` commit.
- Render Free plan does not support `preDeployCommand`.
- Current Render backend build command:

```bash
npm ci --include=dev && npm run db:migrate && npm run build
```

## Migration Evidence

Supabase project: `hr-axis-staging`

Applied migrations:

| Migration | Status | Attempt | Finished At |
| --- | --- | --- | --- |
| `046_import_batch_company_scope.sql` | `succeeded` | 1 | `2026-05-08 16:40:53.570036+00` |
| `047_snapshot_run_company_scope.sql` | `succeeded` | 1 | `2026-05-08 16:40:53.595983+00` |

Verified columns:

| Schema | Table | Column | Data Type |
| --- | --- | --- | --- |
| `stg` | `import_batch` | `company_ids` | `ARRAY` |
| `rpt` | `snapshot_run` | `company_ids` | `ARRAY` |

Supabase Postgres logs showed the `ALTER TABLE`, idempotency index, and GIN index statements for both migration files during the Render build.

## Health Evidence

Backend live health:

```json
{
  "status": "ok",
  "service": "hr-axis-staging-api"
}
```

Backend dependency health:

```json
{
  "status": "ok",
  "service": "hr-axis-staging-api",
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 29
    },
    "redis": {
      "status": "skipped",
      "message": "Redis health check skipped because queue backend is not bullmq"
    }
  }
}
```

## Verification

Post-deploy local pilot stabilization gate:

```powershell
npm.cmd run check:pilot-stabilization
```

Result:

- 14 root contract tests passed.
- `admin-web` production build passed.
- 7 Playwright pilot smoke/API contract tests passed.
- Vercel status for `eafbb53a` returned `success`.

## Decision

`Go` for continuing the current controlled staging/internal pilot scope.

Broad production rollout remains not approved.
