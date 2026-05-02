# Master Data Bootstrap Admin Surface V1 Design

## Purpose

Master data bootstrap V1 now has staging, validation, readiness, store promotion, and personnel promotion. The next safe product step is operator visibility: HR/Admin must be able to see which baseline batches are ready, which rows block promotion, and which live entity id a promoted row wrote to.

This surface does not create user accounts, assign auth roles, or change promotion semantics.

## Scope

V1 adds a frontend admin surface that reuses the existing backend endpoints:

- `GET /api/integrations/master-data-bootstrap/batches`
- `GET /api/integrations/master-data-bootstrap/batches/:batchId`
- `GET /api/integrations/master-data-bootstrap/batches/:batchId/promotion-readiness`
- `POST /api/integrations/master-data-bootstrap/batches/:batchId/validate`
- `POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-stores`
- `POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-personnel`

The surface is available at:

```text
/admin/master-data
/admin/master-data/:batchId
```

Allowed roles:

- `SUPER_ADMIN`
- `HR_ADMIN`
- `INTEGRATION_ADMIN`

## User Experience

The page is an operational review console, not a marketing page. It uses the existing admin dashboard language: dense panels, status pills, row evidence, and restrained controls.

The list view shows recent bootstrap batches with:

- entity type
- batch status
- readiness
- row count
- valid / review / invalid / promoted counts
- source label and file reference

The detail view shows:

- readiness counters
- next action
- validate action
- promote action only when the readiness response says `canPromote`
- row evidence with source codes, issue code/message, resolved ids, and `promotedEntityId`

## Promotion Behavior

The UI never decides promotion eligibility locally. It only displays the backend readiness response and calls the correct backend command:

- store batch -> `promote-stores`
- personnel batch -> `promote-personnel`

If `canPromote` is false, the button is disabled and the blocking counters remain visible.

## Non-Goals

- No master data Excel upload UI in this slice.
- No inline row editing or mapping approval in this slice.
- No user account creation.
- No auth role assignment.
- No backend schema or promotion logic changes.
- No broad redesign of integration pages.

## Testing

Acceptance coverage:

- HR/Admin can open the master data surface from the admin shell.
- Batch list shows readiness and promoted counts.
- Batch detail shows readiness counters and promoted entity evidence.
- Personnel promotion calls the personnel endpoint, not the store endpoint.
- The promote button is disabled when backend readiness says `canPromote: false`.

## CODEX Durust Yorum

Bu dogru siradaki kucuk urun adimi. Promotion kodu backend'de acildi; simdi operator tarafinda kanit gorunurlugu olmadan auth/user creation'a gecmek erken olurdu. Bu yuzey sistemi buyutmuyor, kontrolu artiriyor. En onemli sinir: UI sadece backend kararini gosterir ve komutu tetikler; kendi basina satir uygunlugu hesaplamaz.
