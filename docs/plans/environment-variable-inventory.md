# Environment Variable Inventory

## Metadata

- Status: V1 deployment inventory.
- Owner: Platform, backend, frontend, and release operator.
- Last updated: 2026-07-10.
- Purpose: Keep environment variables visible before staging, pilot, or production deployment.

## Decision Rule

No target environment should be approved until every P0 variable in this document is either filled, intentionally unused, or covered by a written Conditional Go note.

Do not store real values in this document. Store only names, owners, purpose, required status, and source of truth.

## Production Env Contract Guard

This table is the machine-checked minimum contract for production-like environments.
Do not copy values into evidence. Record only variable names, status, and owner.

| Variable | Owner | Runtime location | Classification | Production requirement | Local/default value |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Platform owner | Render backend env | Internal | Must be `production` for production-like backend runtime so fail-closed behavior is active. | `development` |
| `DATABASE_URL` | Backend/Data owner | Render backend env | Secret | Must point to the target Supabase/PostgreSQL database, never local development. | Local example uses disposable local PostgreSQL. |
| `DB_POOL_MAX` | Backend/Data owner | Render backend env | Internal | Must be a positive integer sized for the hosting/database tier. | `20` |
| `DB_CONNECTION_TIMEOUT_MS` | Backend/Data owner | Render backend env | Internal | Must be a positive integer connection budget. | `5000` |
| `DB_IDLE_TIMEOUT_MS` | Backend/Data owner | Render backend env | Internal | Must be a positive integer idle-client eviction budget. | `30000` |
| `DB_QUERY_TIMEOUT_MS` | Backend/Data owner | Render backend env | Internal | Must be a positive integer and no lower than `DB_STATEMENT_TIMEOUT_MS`. | `65000` |
| `DB_STATEMENT_TIMEOUT_MS` | Backend/Data owner | Render backend env | Internal | Must be a positive integer no greater than `DB_QUERY_TIMEOUT_MS`. | `60000` |
| `DB_SSL_MODE` | Project owner | Render backend env | Internal | Production requires `require` or `verify-full`; DG-3 target staging posture is `verify-full` and must not be called active until CA secret plus staging health proof exist. | `disable` |
| `DB_SSL_CA` | Project owner | Render backend secret env | Secret | Required for the DG-3 `verify-full` target; populate only from the Supabase provider certificate contract and never record the value. | Empty placeholder. |
| `AUTH_MODE` | Auth owner | Render backend env | Internal | Must be `jwt` for real environments. | `mock` |
| `AUTH_PROVIDER_KEY` | Auth owner | Render backend env | Public | Must match the provider namespace used in `ops.user_account.auth_provider`; Clerk environments use `clerk`. | `oidc` |
| `ALLOW_MOCK_AUTH` | Auth owner | Render backend env | Internal | Must be `false` or unset in production-like environments. | `true` |
| `MIGRATIONS_HTTP_ENABLED` | Backend/Data owner | Render backend env | Internal | Must remain disabled in production; migrations run through CLI/CI, not HTTP. | `true` locally, forced disabled when `NODE_ENV=production`. |
| `CORS_ALLOWED_ORIGINS` | Backend/Frontend owner | Render backend env | Public | Must list explicit HTTPS frontend origins; `*` is forbidden in production. | `http://localhost:5173` |
| `TRUST_PROXY_HOPS` | Platform owner | Render backend env | Internal | Must match the target reverse-proxy path; Render staging uses `1`. | `0` |
| `RATE_LIMIT_WINDOW_MS` | Backend owner | Render backend env | Internal | Must be explicit for the environment. | `60000` |
| `RATE_LIMIT_MAX` | Backend owner | Render backend env | Internal | Must be explicit for the environment. | `120` |
| `RATE_LIMIT_BACKEND` | Backend/Platform owner | Render backend env | Internal | Use `redis` for broad production; `memory` is controlled-pilot only with written risk acceptance. | `memory` |
| `RATE_LIMIT_REDIS_PREFIX` | Backend/Platform owner | Render backend env | Internal | Must be stable and environment-specific when Redis rate limiting is enabled. | `hr-axis:rate-limit` |
| `QUEUE_BACKEND` | Backend/Platform owner | Render backend env | Internal | Use `bullmq` before broad production durable background processing. | `in-memory` |
| `REDIS_URL` | Platform owner | Render backend env | Secret | Required when `QUEUE_BACKEND=bullmq` or `RATE_LIMIT_BACKEND=redis`. | Local Redis URL. |
| `UPLOAD_PARSE_MAX_CONCURRENCY` | Backend owner | Render backend env | Internal | Must be explicit before broad production upload/import windows. | `1` |
| `UPLOAD_PARSE_TIMEOUT_MS` | Backend owner | Render backend env | Internal | Must be explicit before broad production upload/import windows. | `15000` |
| `PHOTO_MEDIA_STORAGE_ENABLED` | Project owner | Render API env | Internal | Keep `false` until the synthetic-only R2 provider gate is verified. | `false` |
| `PHOTO_MEDIA_SYNTHETIC_ONLY` | Project owner | Render API env | Internal | PR-3 requires exact `true`; real photographs remain blocked. | `true` |
| `PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST` | Project owner | Render API env | Secret-like operational control | PR-4 enabled synthetic staging requires exactly one pre-approved SHA-256 digest. Empty, malformed, or multiple values fail enabled startup. Never place image bytes or private payloads here. | Empty. |
| `PHOTO_MEDIA_REAL_VM_PILOT_ENABLED` | Project owner | Render API env | Internal | Exact-cohort real VM photo intake kill switch. Does not open checklist or action uploads. | `false` |
| `PHOTO_MEDIA_REAL_VM_PILOT_COMPANY_ID` | Project owner | Render API env | Sensitive scope identifier | Exact approved company UUID; must match the visual-comparison cohort. | Empty. |
| `PHOTO_MEDIA_REAL_VM_PILOT_REFERENCE_SET_ID` | Project owner | Render API env | Sensitive scope identifier | Exact approved VM reference-set UUID; must match the visual-comparison cohort. | Empty. |
| `PHOTO_MEDIA_REAL_VM_PILOT_NOT_BEFORE` | Project owner | Render API env | Internal | Timezone-qualified ISO lower bound; must match the visual-comparison cohort. | Empty. |
| `CHECKLIST_EVIDENCE_CAPTURE_ENABLED` | Project owner | Render API env | Internal | Independent capture control; remains `false` until PR-4 synthetic device proof is accepted. | `false` |
| `CHECKLIST_REQUIRED_EVIDENCE_ENFORCEMENT_ENABLED` | Project owner | Render API env | Internal | Allows publishing new required policies only when capture and storage health are also enabled. | `false` |
| `CHECKLIST_EVIDENCE_STORAGE_HEALTHY` | Platform owner | Render API env | Internal | Explicit fail-closed storage-health gate for new required policy publication. | `false` |
| `STORE_ACTION_PHOTO_RESOLUTION_ENABLED` | Project owner | Render API env | Internal | Pins only newly generated trusted checklist-remediation actions to V2 and enables Store Manager synthetic solution submission. Keep `false` until a separate activation gate. | `false` |
| `REGION_MANAGER_SOLUTION_REVIEW_ENABLED` | Project owner | Render API env | Internal | Enables assigned Region Manager review. During rollback keep this `true` only to drain an already-existing pending queue; otherwise default `false`. | `false` |
| `VM_REFERENCE_PUBLISHING_ENABLED` | Project owner | Render API env | Internal | Enables scoped synthetic VM draft/publish commands; permission grants remain separately default-denied. | `false` |
| `VM_CAMPAIGN_SUBMISSION_ENABLED` | Project owner | Render API env | Internal | Enables own-store synthetic VM campaign submissions within an immutable window. | `false` |
| `VM_CAMPAIGN_DEADLINE_SETTLEMENT_ENABLED` | Project owner | Render worker env | Internal | Enables bounded idempotent VM campaign deadline settlement. | `false` |
| `VM_CAMPAIGN_SETTLEMENT_POLL_SECONDS` | Project owner | Render worker env | Internal | Poll interval for bounded VM campaign settlement. | `60` |
| `VISUAL_COMPARISON_ENQUEUE_ENABLED` | Project owner | Render worker env | Internal | Independent reconciler/enqueue kill switch. Keep `false` until the exact PR9 shadow scope is configured. | `false` |
| `VISUAL_COMPARISON_ADVISORY_ENQUEUE_ENABLED` | Project owner | Render worker env | Internal | Advisory enqueue kill switch. Mutually exclusive with shadow enqueue. | `false` |
| `VISUAL_COMPARISON_ADVISORY_REVIEW_ENABLED` | Project owner | Render API env | Internal | Region Manager advisory visibility and review kill switch. Exact visual-comparison scope is required when enabled. | `false` |
| `VISUAL_COMPARISON_WORKER_ENABLED` | Project owner | Render worker env | Internal | Independent Qwen execution kill switch. Requires BullMQ, healthy private media storage, exact scope, host pin and positive price ceilings. | `false` |
| `VISUAL_COMPARISON_COMPANY_ID` | Project owner | Render worker env | Sensitive scope identifier | Exact company UUID allowlist for the hidden shadow run; never record its value in evidence. | Empty. |
| `VISUAL_COMPARISON_REFERENCE_SET_ID` | Project owner | Render worker env | Sensitive scope identifier | Exact immutable reference-set UUID allowlist for the hidden shadow run. | Empty. |
| `VISUAL_COMPARISON_NOT_BEFORE` | Project owner | Render worker env | Internal | ISO timestamp lower bound that excludes earlier submissions from the approved shadow cohort. | Empty. |
| `VISUAL_COMPARISON_RECONCILE_LIMIT` | Backend owner | Render worker env | Internal | Maximum ledger rows reconciled per bounded poll. | `20` |
| `VISUAL_COMPARISON_RECONCILE_POLL_SECONDS` | Backend owner | Render worker env | Internal | Poll interval for idempotent shadow reconciliation. | `60` |
| `VISUAL_COMPARISON_MAX_ATTEMPTS` | Backend owner | Render worker env | Internal | Durable maximum attempts before terminal failure. | `3` |
| `VISUAL_COMPARISON_PROCESSING_LEASE_SECONDS` | Backend owner | Render worker env | Internal | Processing lease used to recover stalled work without concurrent overwrite. | `300` |
| `QUEUE_VISUAL_COMPARISON_NAME` | Backend/Platform owner | Render worker env | Internal | Stable isolated queue name for hidden visual-comparison shadow jobs. | `store-ops-visual-comparison-shadow` |
| `QWEN_BASE_URL` | Platform owner | Render worker env | Provider endpoint | Exact approved EU Model Studio API base URL; private media is sent only after host-pin validation. | Empty. |
| `QWEN_ALLOWED_HOST_SHA256` | Security owner | Render worker env | Integrity control | SHA-256 pin of the exact approved provider hostname. | Empty. |
| `QWEN_API_KEY` | Platform owner | Render worker secret env | Secret | Workspace-scoped key restricted to the approved exact model snapshot; never log or document its value. | Empty. |
| `QWEN_MODEL` | Project owner | Render worker env | Internal | Must equal the approved snapshot `qwen3.7-plus-2026-05-26` while PR9 is active. | `qwen3.7-plus-2026-05-26` |
| `QWEN_TIMEOUT_MS` | Backend owner | Render worker env | Internal | Per-request timeout ceiling. | `30000` |
| `QWEN_MAX_RESPONSE_BYTES` | Backend owner | Render worker env | Internal | Maximum accepted provider response size. | `65536` |
| `QWEN_MAX_OUTPUT_TOKENS` | Project owner | Render worker env | Cost control | Maximum advisory output tokens per request. | `1024` |
| `QWEN_SHADOW_MAX_REQUESTS` | Project owner | Render worker env | Cost control | Durable aggregate request ceiling for the approved shadow cohort. | `20` |
| `QWEN_MAX_TOKENS_PER_REQUEST` | Project owner | Render worker env | Cost control | Maximum total tokens accepted for one provider response. | `20000` |
| `QWEN_SHADOW_MAX_TOTAL_TOKENS` | Project owner | Render worker env | Cost control | Durable aggregate token ceiling across restarts and replicas. | `400000` |
| `QWEN_SHADOW_MAX_SPEND_USD_MICROS` | Project owner | Render worker env | Cost control | Durable aggregate spend ceiling in USD micros. | `1000000` |
| `QWEN_INPUT_USD_MICROS_PER_MILLION_TOKENS` | Project owner | Render worker env | Cost control | Current provider input price used for fail-closed reservation; must be positive when enabled. | `0` while disabled. |
| `QWEN_OUTPUT_USD_MICROS_PER_MILLION_TOKENS` | Project owner | Render worker env | Cost control | Current provider output price used for fail-closed reservation; must be positive when enabled. | `0` while disabled. |
| `QWEN_MIN_ADVISORY_CONFIDENCE` | Project owner | Render worker env | Internal | Minimum confidence for advisory benchmark reporting only; never changes official score. | `0.6` |
| `PHOTO_MEDIA_PRIMARY_BUCKET` | Platform owner | Render API secret env | Secret identifier | Private EU-jurisdiction primary bucket name; never record its value in evidence. | Empty. |
| `PHOTO_MEDIA_RECOVERY_BUCKET` | Platform owner | Render API secret env | Secret identifier | Distinct private EU-jurisdiction recovery bucket name. | Empty. |
| `PHOTO_MEDIA_PRIMARY_ENDPOINT` | Platform owner | Render API env | Internal | Exact account-scoped R2 EU endpoint; no public delivery endpoint. | Empty. |
| `PHOTO_MEDIA_RECOVERY_ENDPOINT` | Platform owner | Render API env | Internal | Exact account-scoped R2 EU endpoint for recovery. | Empty. |
| `PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID` | Platform owner | Render API secret env | Secret | Primary-bucket-scoped credential ID. | Empty. |
| `PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY` | Platform owner | Render API secret env | Secret | Primary-bucket-scoped credential secret. | Empty. |
| `PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID` | Platform owner | Render API secret env | Secret | Separate recovery-bucket-scoped credential ID. | Empty. |
| `PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY` | Platform owner | Render API secret env | Secret | Separate recovery-bucket-scoped credential secret. | Empty. |
| `PHOTO_MEDIA_AGGREGATE_BYTES_HARD_LIMIT` | Backend owner | Render API env | Internal | Must not exceed the owner-approved 8 GiB synthetic staging ceiling. | `8589934592` |
| `PHOTO_MEDIA_MONTHLY_CLASS_A_HARD_LIMIT` | Backend owner | Render API env | Internal | Must not exceed `750000`. | `750000` |
| `PHOTO_MEDIA_MONTHLY_CLASS_B_HARD_LIMIT` | Backend owner | Render API env | Internal | Must not exceed `7500000`. | `7500000` |
| `PHOTO_MEDIA_SIGNED_READ_TTL_SECONDS` | Security owner | Render API env | Internal | Short-lived signed delivery; maximum enforced by application contract. | `120` |
| `PHOTO_MEDIA_LOCK_SAFETY_DAYS` | Project owner | Render API env | Internal | Exact owner-approved canonical `locked/` safety window. | `30` |
| `PHOTO_MEDIA_PER_USER_DAILY_BYTES_HARD_LIMIT` | Backend owner | Render API env | Internal | Fail-closed per-user daily upload byte ceiling. | `104857600` |
| `PHOTO_MEDIA_PER_STORE_DAILY_BYTES_HARD_LIMIT` | Backend owner | Render API env | Internal | Fail-closed per-store daily upload byte ceiling. | `262144000` |
| `PHOTO_MEDIA_CONCURRENT_PROCESSING_HARD_LIMIT` | Backend owner | Render API env | Internal | Lease-based concurrent decode/scan ceiling; maximum 4 in synthetic staging. | `2` |
| `PHOTO_MEDIA_SCHEDULED_RETENTION_CLEANUP_ENABLED` | Project owner | Render API env | Destructive-operation control | Keep `false`. Setting `true` requires the separately approved retention execution gate and bounded staging run window. | `false` |
| `PHOTO_MEDIA_RETENTION_MANIFEST_TTL_MINUTES` | Backend owner | Render API env | Internal | Exact preview-to-execute validity window; expired manifests fail closed. | `60` |
| `PHOTO_MEDIA_RETENTION_WARNING_PERCENT` | Backend owner | Render API env | Internal | Aggregate storage/operation warning boundary; must be below the critical boundary. | `70` |
| `PHOTO_MEDIA_RETENTION_CRITICAL_PERCENT` | Backend owner | Render API env | Internal | Aggregate storage/operation critical boundary; must be above warning and at most 100. | `85` |
| `READINESS_PROFILE` | Release operator | Render backend env | Internal | Keep `controlled-pilot` until broad production is approved. | `controlled-pilot` |
| `JWT_ISSUER` | Auth owner | Render backend env | Public | Must exactly match the Clerk issuer. | Local mock issuer. |
| `JWT_AUDIENCE` | Auth owner | Render backend env | Public | Must match the backend API audience accepted by Clerk tokens. | `store-ops-api` |
| `JWT_JWKS_URL` | Auth owner | Render backend env | Public | Required for Clerk/JWKS verification in real environments. | Empty in local example. |
| `JWT_SECRET` | Auth owner | Render backend env | Secret | Must be empty with JWKS or non-default only for an approved non-JWKS mode. | `change-me` local placeholder. |
| `AUTH_AUTHORIZATION_URL` | Auth owner | Render backend env | Public | Must be the real provider authorization URL exposed by auth bootstrap. | Empty in local example. |
| `AUTH_CLIENT_ID` | Auth owner | Render backend env | Public | Must match the real Clerk browser/client id when bootstrap exposes auth metadata. | Empty in local example. |
| `AUTH_SCOPE` | Auth owner | Render backend env | Public | Must include `openid profile email` unless provider approval changes scope. | `openid profile email` |
| `AUTH_RESPONSE_TYPE` | Auth owner | Render backend env | Public | Must be `code` for PKCE login. | `code` |
| `AUTH_TOKEN_URL` | Auth owner | Render backend env | Public | Must be the real provider token URL for PKCE exchange. | Empty in local example. |
| `AUTH_CALLBACK_PATH` | Auth owner | Render backend env | Public | Must match the frontend/provider callback registration. | `/auth/callback` |
| `AUTH_POST_LOGOUT_REDIRECT_PATH` | Auth owner | Render backend env | Public | Must match provider post-logout registration. | `/auth/login` |
| `BROWSER_SESSION_COOKIE_ENABLED` | Auth owner | Render backend env | Internal | Enables backend-owned browser app-session cookies only after the session contract PRs land. | `false` |
| `BROWSER_SESSION_COOKIE_NAME` | Auth owner | Render backend env | Internal | Stable host-only HttpOnly app-session cookie name; do not add a cookie `Domain` attribute without owner approval. | `hr_axis_browser_session` |
| `BROWSER_SESSION_CSRF_COOKIE_NAME` | Auth owner | Render backend env | Internal | Optional same-host CSRF nonce compatibility cookie name; current staging/production uses response nonce transport instead. | `hr_axis_csrf_nonce` |
| `BROWSER_SESSION_SECRET` | Auth owner | Render backend env | Secret | Required and non-default when cookie sessions are enabled in production-like backends. | Empty placeholder. |
| `BROWSER_SESSION_PREVIOUS_SECRET` | Auth owner | Render backend env | Secret | Optional previous signing secret for rotation; must be non-default and differ from the current secret when set. | Empty placeholder. |
| `BROWSER_SESSION_TTL_SECONDS` | Auth owner | Render backend env | Internal | Default `900`; values above `3600` require explicit owner approval and must not be used by this train. | `900` |
| `BROWSER_SESSION_RENEWAL_WINDOW_SECONDS` | Auth owner | Render backend env | Internal | Renewal window must be lower than the app-session TTL and renewal must be provider-backed. | `120` |
| `BROWSER_SESSION_SAME_SITE` | Auth owner | Render backend env | Internal | Must be `lax` or `strict` unless `SameSite=None` has explicit owner approval and Secure cookies are active. | `lax` |
| `VITE_API_BASE_URL` | Frontend owner | Cloudflare frontend build env | Public | Must point to the target backend `/api` URL. | `/api` |
| `VITE_SENTRY_DSN` | Frontend owner | Cloudflare frontend build env | Public ingest key | Browser-visible Sentry ingest DSN; keep it in the controlled build env, never source code. | Empty. |
| `VITE_SENTRY_ENABLED` | Frontend owner | Cloudflare frontend build env | Public | Exact `true`/`false`; default `false` until the frontend receipt is approved. | `false` |
| `VITE_SENTRY_ENVIRONMENT` | Frontend owner | Cloudflare frontend build env | Public | Stable Sentry environment label, `staging` for the current project. | `development` |
| `VITE_SENTRY_RELEASE` | Frontend owner | Cloudflare frontend build env | Public | Optional deployed release/commit label; no secrets. | Empty. |
| `VITE_AUTH_MODE` | Frontend/Auth owner | Cloudflare frontend build env | Public | Must be `bearer` for real environments. | `mock` |
| `VITE_BROWSER_SESSION_TRANSPORT` | Frontend/Auth owner | Cloudflare frontend build env | Public | Selects real browser session transport: `bearer` for legacy rollback or `cookie` after backend cookie-session support is proven. | `bearer` |
| `VITE_AUTH_PROVIDER` | Frontend/Auth owner | Cloudflare frontend build env | Public | Must be `clerk` when Clerk owns browser auth. | `oidc` |
| `VITE_BEARER_TOKEN` | Frontend/Auth owner | Cloudflare frontend build env | Secret | Must stay empty in production and committed examples. | Empty. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend/Auth owner | Cloudflare frontend build env | Public | Required when `VITE_AUTH_PROVIDER=clerk`; publishable key only. | Empty in local example. |
| `VITE_CLERK_JWT_TEMPLATE` | Frontend/Auth owner | Cloudflare frontend build env | Public | Set only when backend audience verification requires a Clerk JWT template. | Empty in local example. |
| `DAILY_CLOSURE_ACTOR_USER_ID` | Backend owner | Render backend env | Secret | Required only if daily closure automation is enabled; must identify a real service/operator actor. | Local seed actor placeholder. |

## Backend Runtime Variables

These values are read by `backend/nestjs/src/shared/app-config.service.ts`.

| Variable | P0/P1 | Production rule | Notes |
| --- | --- | --- | --- |
| `APP_PORT` | P1 | Explicit app port when the hosting platform does not inject `PORT`. | Overrides `PORT`; defaults to `3000`. |
| `PORT` | P1 | Hosting platform injected port. | Used when `APP_PORT` is empty; Render/Koyeb-style platforms may set this automatically. |
| `APP_NAME` | P1 | Stable service name. | Defaults to `store-ops-backend`. |
| `NODE_ENV` | P0 | Must be `production` in production. | Controls production auth fail-closed behavior. |
| `DATABASE_URL` | P0 | Must point to target DB, never local development. | Secret-bearing connection string. |
| `DB_POOL_MAX` | P1 | Size for hosting tier. | Defaults to `20`. |
| `DB_CONNECTION_TIMEOUT_MS` | P1 | Positive connection-acquisition budget. | Defaults to `5000`. |
| `DB_IDLE_TIMEOUT_MS` | P1 | Positive idle-client eviction budget. | Defaults to `30000`. |
| `DB_QUERY_TIMEOUT_MS` | P1 | Positive client query budget no lower than the statement timeout. | Defaults to `65000`. |
| `DB_STATEMENT_TIMEOUT_MS` | P1 | Positive server statement budget no greater than the query timeout. | Defaults to `60000`. |
| `DB_SSL_MODE` | P0 | Production requires `require` or `verify-full`; DG-3 target staging posture is provider-proven `verify-full`. | Local default is `disable`; activation remains pending until `DB_SSL_CA` is installed and `/api/health` reports `encrypted-verified`. |
| `DB_SSL_CA` | P0 conditional | Required for `verify-full`; must come from the Supabase provider certificate contract. | Secret; committed example remains empty and the value is never logged. |
| `AUTH_MODE` | P0 | Must be `jwt` for real environments. | Local may use `mock`. |
| `AUTH_PROVIDER_KEY` | P0 | Must match the provider subject namespace, such as `clerk` for Clerk staging. | Default `oidc`; used when mapping JWT `sub` to `ops.user_account.auth_provider/provider_subject`. |
| `ALLOW_MOCK_AUTH` | P0 | Must be `false` or unset in production. | Production must not allow mock auth. |
| `MIGRATIONS_HTTP_ENABLED` | P0 | Forced disabled when `NODE_ENV=production`. | Enables the legacy HTTP migration endpoint only for local/non-production controlled use; production must use CLI/CI migration execution. |
| `CORS_ALLOWED_ORIGINS` | P0 | Required in production. | Comma-separated browser origins; local default is `http://localhost:5173`. |
| `TRUST_PROXY_HOPS` | P0 | Required in production. | Trusted reverse-proxy hop count used by Express `req.ip` and rate-limit client identity; local default is `0`, Render staging uses `1`. |
| `RATE_LIMIT_WINDOW_MS` | P0 | Required in production. | Request window; local default is `60000`. |
| `RATE_LIMIT_MAX` | P0 | Required in production. | Max requests per client/window; local default is `120`. |
| `RATE_LIMIT_BACKEND` | P0 | `memory` is allowed for local and controlled pilot; `redis` is required when `READINESS_PROFILE=broad-production`. | Controls whether rate limit counters are process-local or shared through Redis. |
| `RATE_LIMIT_REDIS_PREFIX` | P1 | Stable prefix per environment when Redis rate limiting is enabled. | Defaults to `hr-axis:rate-limit`; use an environment-specific prefix if staging and production share a Redis provider. |
| `UPLOAD_PARSE_MAX_CONCURRENCY` | P0 for broad production, P1 for controlled pilot | Required when `READINESS_PROFILE=broad-production`; controlled pilot default is `1`. | Limits concurrent Power BI export parsing inside the API process. Increase only after CPU/memory evidence is reviewed. |
| `UPLOAD_PARSE_TIMEOUT_MS` | P0 for broad production, P1 for controlled pilot | Required when `READINESS_PROFILE=broad-production`; controlled pilot default is `15000`. | Retryable timeout budget for upload parsing. Sustained timeouts mean parsing should move out of the API request path. |
| `LOG_LEVEL` | P1 | Use `info`, `warn`, or `error` unless debugging a controlled incident. | Controls Nest logger verbosity; local default is `info`. |
| `ERROR_TRACKING_DSN` | P1 | Leave empty for log-only mode; use the HTTPS Sentry DSN from the provider secret boundary. | Render API and worker secret; never commit, log, or paste into evidence/chat. |
| `ERROR_TRACKING_ENABLED` | P1 | Exact `true`/`false`; default is `false` so a DSN alone cannot activate external delivery. | Enables the Sentry adapter only after the staging provider and redaction setup are ready. |
| `ERROR_TRACKING_ENVIRONMENT` | P1 | Stable environment label such as `staging` or `production`. | Included in structured observability events and Sentry issue metadata. |
| `ERROR_TRACKING_RELEASE` | P1 | Current deployed commit or release id when known. | Included in structured observability events and Sentry issue metadata; do not store secrets. |
| `ERROR_TRACKING_SMOKE` | P1 temporary | Set `true` only for a controlled staging startup receipt, then return to `false`. | Emits one sanitized DG4 startup event per API/worker restart; no public endpoint. |
| `READINESS_PROFILE` | P0 | `controlled-pilot` until broad production rollout is approved; `broad-production` requires explicit observability review. | Broad production without enabled external error delivery is marked degraded and logs a startup warning. |
| `JWT_AUDIENCE` | P0 | Must match accepted access token audience. | Defaults to `store-ops-api`. |
| `JWT_ISSUER` | P0 | Must exactly match provider issuer. | Production rejects issuer mismatch. |
| `JWT_JWKS_URL` | P0 | Required for real IdP JWT verification. | Preferred over shared secret verification. |
| `JWT_SECRET` | P0 conditional | Empty with JWKS; non-default only for approved non-JWKS mode. | Must never be `change-me` in production without JWKS. |
| `AUTH_AUTHORIZATION_URL` | P0 | Real provider authorize URL. | Used by `/api/auth/bootstrap`. |
| `AUTH_CLIENT_ID` | P0 | Real public browser client id. | No client secret in frontend. |
| `AUTH_SCOPE` | P0 | Includes `openid profile email`. | Add provider-specific role scope only if required. |
| `AUTH_RESPONSE_TYPE` | P0 | Must be `code`. | PKCE login expects authorization code. |
| `AUTH_TOKEN_URL` | P0 | Real provider token URL. | Required for PKCE code exchange. |
| `AUTH_AUDIENCE_OVERRIDE` | P1 conditional | Set only if provider requires `audience` auth param. | Leave empty otherwise. |
| `AUTH_CALLBACK_PATH` | P0 | `/auth/callback` unless route changes. | Must match provider callback registration. |
| `AUTH_LOGOUT_URL` | P1 | Provider logout endpoint when supported. | Needed for provider logout smoke. |
| `AUTH_POST_LOGOUT_REDIRECT_PATH` | P0 | `/auth/login` unless route changes. | Must match provider post-logout registration. |
| `BROWSER_SESSION_COOKIE_ENABLED` | P0 for launch cookie transport, P1 while disabled | Must be `true` only after browser-session endpoint, CSRF, frontend bridge, and evidence guards are merged. | Defaults to `false`; does not weaken existing bearer/script rollback support. |
| `BROWSER_SESSION_COOKIE_NAME` | P1 | Stable host-only app-session cookie name. | No cookie `Domain` attribute is configured by this contract. |
| `BROWSER_SESSION_CSRF_COOKIE_NAME` | P1 | Optional same-host CSRF nonce compatibility cookie name only. | Current staging/production frontend/API subdomains use response nonce transport, not a widened cookie domain. |
| `BROWSER_SESSION_SECRET` | P0 conditional | Required, at least 32 characters, and non-default when cookie sessions are enabled in production-like backends. | Secret-bearing signing key; keep committed examples empty. |
| `BROWSER_SESSION_PREVIOUS_SECRET` | P1 conditional | Optional previous signing secret for rotation; when set, must be non-default and differ from `BROWSER_SESSION_SECRET`. | Used only to verify old cookies while signing with the current secret. |
| `BROWSER_SESSION_TTL_SECONDS` | P0 | Default `900`; values above `3600` require explicit owner approval. | App session cannot refresh itself from the cookie alone. |
| `BROWSER_SESSION_RENEWAL_WINDOW_SECONDS` | P1 | Must be lower than `BROWSER_SESSION_TTL_SECONDS`. | Frontend renewal must re-derive a session from the active provider browser session. |
| `BROWSER_SESSION_SAME_SITE` | P0 | `lax` by default; `none` requires Secure cookies and explicit owner approval. | Current staging/production hosts are same-site subdomains, so `none` is not the default. |
| `QUEUE_BACKEND` | P0 | `in-memory` is allowed for local and controlled pilot; `bullmq` is required when `READINESS_PROFILE=broad-production` or durable background processing is required. | Local default is `in-memory`; BullMQ uses Redis-backed queues. |
| `REDIS_URL` | P0 conditional | Required when `QUEUE_BACKEND=bullmq` or `RATE_LIMIT_BACKEND=redis` in production. | Secret-bearing if provider uses credentials. |
| `QUEUE_IMPORT_NAME` | P1 | Stable import queue name. | Defaults to `store-ops-import`. |
| `QUEUE_SNAPSHOT_NAME` | P1 | Stable snapshot queue name. | Defaults to `store-ops-snapshot`. |
| `DAILY_CLOSURE_AUTOMATION_ENABLED` | P1 | Keep `false` until closure schedule is approved. | Enables automated closure polling. |
| `DAILY_CLOSURE_POLL_MINUTES` | P1 | Approved polling interval. | Defaults to `15`. |
| `DAILY_CLOSURE_ACTOR_USER_ID` | P0 conditional | Required if daily closure automation is enabled. | Must be a real service/operator actor id. |

Mobile Auth/Session V1 P0 note:

- No new backend environment variable was added for mobile device sessions.
- Mobile session endpoints rely on the existing JWT/JWKS, CORS, rate-limit, and database variables above.
- Refresh tokens remain IdP-owned in V1; do not add backend refresh-token secrets or committed examples until a separate broker phase is explicitly approved.

## Frontend Build-Time Variables

These values are read by `admin-web/src`.

| Variable | P0/P1 | Production rule | Notes |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | P0 | Points to production backend `/api`. | Public value, not secret. |
| `VITE_SENTRY_DSN` | P1 | Sentry ingest DSN for the selected project; no server secret. | Browser-visible by design; configure only in the controlled Cloudflare build environment. |
| `VITE_SENTRY_ENABLED` | P1 | Exact `true`/`false`; enable only after frontend staging receipt and redaction review. | Default `false`; rollback is flag-only. |
| `VITE_SENTRY_ENVIRONMENT` | P1 | Stable Sentry environment label, `staging` for the current staging project. | Used in issue metadata. |
| `VITE_SENTRY_RELEASE` | P1 | Optional deployed commit/release id. | Used for grouping when supplied; do not store secrets. |
| `VITE_AUTH_MODE` | P0 | Must be `bearer` for real environments. | Local can use `mock`. |
| `VITE_BROWSER_SESSION_TRANSPORT` | P0 for launch browser sessions | `bearer` preserves the legacy rollback path; `cookie` is the launch target after backend cookie sessions are proven. | Separate from `VITE_AUTH_MODE`; do not overload auth mode as the transport flag. |
| `VITE_AUTH_PROVIDER` | P0 | Use `clerk` when Clerk owns browser authentication. | Enables Clerk frontend bridge; authorization remains in HR Axis DB. |
| `VITE_USER_ID` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_ROLE_CODES` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_COMPANY_IDS` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_STORE_IDS` | P1 local-only | Do not use for production auth. | Mock-session store-scope helper only. |
| `VITE_READ_STORE_IDS` | P1 local-only | Do not use for production auth. | Mock-session read store-scope helper only; falls back to `VITE_STORE_IDS` when empty. |
| `VITE_ASSIGNED_STORE_IDS` | P1 local-only | Do not use for production auth. | Mock-session assigned/action store-scope helper only; falls back to `VITE_STORE_IDS` when empty. |
| `VITE_REGION_IDS` | P1 local-only | Do not use for production auth. | Mock-session region-scope helper only. |
| `VITE_READ_REGION_IDS` | P1 local-only | Do not use for production auth. | Mock-session read region-scope helper only; falls back to `VITE_REGION_IDS` when empty. |
| `VITE_BEARER_TOKEN` | P0 local-only | Must be empty in committed examples and production. | Never put real tokens in env files. |
| `VITE_CLERK_PUBLISHABLE_KEY` | P0 conditional | Required when `VITE_AUTH_PROVIDER=clerk`. | Public Clerk publishable key only; never store Clerk secret key in frontend env. |
| `VITE_CLERK_JWT_TEMPLATE` | P1 conditional | Set to the Clerk JWT template used for the backend API audience when required. | Leave empty to use the default Clerk session token. |
| `VITE_OIDC_AUTHORIZATION_URL` | P0 fallback | Real provider authorize URL if bootstrap is unavailable. | Backend bootstrap is preferred. |
| `VITE_OIDC_CLIENT_ID` | P0 fallback | Real public client id if bootstrap is unavailable. | Public, not secret. |
| `VITE_OIDC_SCOPE` | P0 fallback | Includes `openid profile email`. | Match backend/provider registration. |
| `VITE_OIDC_RESPONSE_TYPE` | P0 fallback | Must be `code` for PKCE. | Do not use `token` in production examples. |
| `VITE_OIDC_AUDIENCE` | P1 conditional | Set only if provider requires audience. | Public request parameter. |
| `VITE_OIDC_CALLBACK_PATH` | P0 fallback | `/auth/callback`. | Must match provider registration. |
| `VITE_OIDC_TOKEN_URL` | P0 fallback | Real provider token URL if bootstrap is unavailable. | Needed for PKCE exchange. |
| `VITE_OIDC_LOGOUT_URL` | P1 fallback | Real provider logout URL if bootstrap is unavailable. | Used for provider logout. |
| `VITE_POST_LOGOUT_REDIRECT_PATH` | P0 fallback | `/auth/login`. | Must match provider registration. |

Production preference:

- The backend `/api/auth/bootstrap` response should supply provider values.
- Frontend `VITE_OIDC_*` values remain a fallback and local configuration aid.
- No frontend variable may contain a client secret, raw token, refresh token, PKCE verifier, or private key.

## Auth Smoke Evidence Variables

These values are read by `admin-web/scripts/auth-live-smoke.mjs`.

| Variable | P0/P1 | Staging rule | Notes |
| --- | --- | --- | --- |
| `AUTH_SMOKE_BASE_URL` | P0 | Non-local HTTPS frontend URL. | Required in staging mode. |
| `AUTH_SMOKE_API_BASE_URL` | P0 | Non-local HTTPS backend `/api` URL. | Required in staging mode. |
| `AUTH_SMOKE_USERNAME` | P0 | Real staging smoke user. | Do not commit real username if sensitive. |
| `AUTH_SMOKE_PASSWORD` | P0 | Secret. | Never commit or paste into evidence. |
| `AUTH_SMOKE_EXPECTED_ROLE` | P0 | Expected app role code. | Example: `STORE_MANAGER`. |
| `AUTH_SMOKE_EXPECTED_LANDING` | P1 | Expected post-login route. | Defaults to `/store`. |
| `AUTH_SMOKE_ENVIRONMENT` | P0 | Target evidence name. | Example: `staging`. |
| `AUTH_SMOKE_PROVIDER_NAME` | P0 | Human-readable provider name. | Evidence metadata. |
| `AUTH_SMOKE_PROVIDER_ISSUER` | P0 | Non-local HTTPS issuer. | Must match `JWT_ISSUER`. |
| `AUTH_SMOKE_JWKS_URL` | P0 | Non-local HTTPS JWKS URL. | Must match backend verification. |
| `AUTH_SMOKE_ACCEPTED_AUDIENCE` | P0 | Expected token audience. | Must satisfy `JWT_AUDIENCE`. |
| `AUTH_SMOKE_ASSIGNED_STORE_ID` | P0 action smoke | Store id where action should succeed. | Required for staging action smoke. |
| `AUTH_SMOKE_UNASSIGNED_STORE_ID` | P0 action smoke | Store id where action should return `403`. | Required for negative action smoke. |
| `AUTH_SMOKE_ACTION_REQUEST_MONTH` | P0 action smoke | Request month for target-distribution action. | Format `YYYY-MM-01`. |

## Secret Handling Rules

- Do not commit `.env` files.
- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE `code_verifier` values.
- Do not paste client secrets.
- Do not store production credentials in screenshots.
- Do not record browser app-session cookie values, CSRF nonce values, provider
  subjects, or browser storage dumps in evidence.
- Keep committed `.env.example` files placeholder-only.
- Store real secrets in the hosting environment or secret manager.
- Rotate any value that appears in chat, issue comments, screenshots, or logs.
- Supabase Boundary Guard: frontend files must not contain Supabase `service_role` / secret keys, `DATABASE_URL`, `JWT_SECRET`, direct Supabase client access to `ops.*`, or direct Supabase REST access to `ops.*`.
- Direct Supabase client access to `ops.*` remains blocked until RLS and policy design is written, tested, and approved; direct Supabase REST access is the same boundary violation.

## Production Fill-In Checklist

### Backend

- [ ] `NODE_ENV=production`
- [ ] `AUTH_MODE=jwt`
- [ ] `AUTH_PROVIDER_KEY` matches the real provider namespace, for example `clerk`.
- [ ] `ALLOW_MOCK_AUTH=false` or unset with production fail-closed behavior verified.
- [ ] `DATABASE_URL` points to production DB.
- [ ] `CORS_ALLOWED_ORIGINS` lists only approved frontend origins.
- [ ] `TRUST_PROXY_HOPS` matches the target backend proxy path, such as `1` for Render.
- [ ] `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` are explicitly set for the environment.
- [ ] `RATE_LIMIT_BACKEND=redis` when `READINESS_PROFILE=broad-production`; `memory` is only accepted for local or controlled pilot risk.
- [ ] `REDIS_URL` is explicitly configured when production rate limiting uses Redis.
- [ ] `RATE_LIMIT_REDIS_PREFIX` is unique to the environment when Redis is shared.
- [ ] `UPLOAD_PARSE_MAX_CONCURRENCY` and `UPLOAD_PARSE_TIMEOUT_MS` are explicit before broad production.
- [ ] Upload parse logs are reviewed for duration, row count, and API latency before increasing parse concurrency above `1`.
- [ ] `QUEUE_BACKEND=bullmq` when `READINESS_PROFILE=broad-production`; `in-memory` is only accepted for local or controlled pilot risk.
- [ ] `/api/health` shows queue `status=durable` and Redis `status=ok` before durable background work is approved.
- [ ] `LOG_LEVEL` is set to the intended runtime verbosity.
- [ ] `ERROR_TRACKING_ENVIRONMENT` and `ERROR_TRACKING_RELEASE` identify the deploy in structured observability events.
- [ ] `READINESS_PROFILE=controlled-pilot` unless broad production rollout is explicitly approved.
- [ ] If `READINESS_PROFILE=broad-production`, enabled external error delivery is configured through a provider-approved path or an accepted Conditional Go risk is recorded.
- [ ] `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_JWKS_URL` match real provider.
- [ ] `JWT_SECRET` is empty when JWKS is used, or explicitly approved for non-JWKS mode.
- [ ] Provider authorize/token/logout URLs are filled.
- [ ] If cookie browser sessions are enabled, `BROWSER_SESSION_SECRET` is set
      through provider secrets, `BROWSER_SESSION_PREVIOUS_SECRET` is set only
      during rotation, TTL is `900` unless approved otherwise, and
      `BROWSER_SESSION_SAME_SITE` remains `lax` or `strict` unless explicit
      owner approval exists for `none`.
- [ ] Queue backend and Redis are filled if durable workers are enabled.
- [ ] Daily closure automation remains disabled until approved.

### Frontend

- [ ] `VITE_API_BASE_URL` points to production API.
- [ ] `VITE_AUTH_MODE=bearer`.
- [ ] `VITE_BROWSER_SESSION_TRANSPORT=cookie` only after backend cookie
      session support, frontend bridge, CSRF guard, and sanitized evidence are
      merged; otherwise keep `bearer` as controlled rollback.
- [ ] `VITE_AUTH_PROVIDER` matches the browser auth provider, for example `clerk`.
- [ ] `VITE_SENTRY_ENABLED` is enabled only after the sanitized frontend staging receipt is accepted.
- [ ] `VITE_SENTRY_ENVIRONMENT` and `VITE_SENTRY_RELEASE` identify the frontend deploy when supplied.
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` is set only when Clerk is enabled.
- [ ] `VITE_CLERK_JWT_TEMPLATE` is set only when backend audience verification requires a Clerk JWT template.
- [ ] `VITE_OIDC_RESPONSE_TYPE=code` if frontend fallback provider env is used.
- [ ] `VITE_BEARER_TOKEN` is empty.
- [ ] No `VITE_*` value contains a secret.
- [ ] `npm.cmd run check:supabase-boundary` passes before direct Supabase/RLS exposure is considered.

### Smoke

- [ ] Staging smoke variables are supplied through local shell or CI secret store.
- [ ] `AUTH_SMOKE_PASSWORD` is not written to docs.
- [ ] Assigned and unassigned store ids are seeded and approved.
- [ ] Evidence is piped through `npm.cmd run guard:auth:evidence`.

## Drift Guard

Root script tests keep this inventory aligned with code and committed env examples.

The guard reads env names from:

- `backend/nestjs/src/shared/app-config.service.ts` via `AppConfigService`.
- `backend/nestjs/src/shared/photo-media-runtime-config.ts` and
  `backend/nestjs/src/shared/visual-comparison-runtime-config.ts` via their
  bounded runtime configuration readers.
- `admin-web/src` via `import.meta.env` usage.
- `admin-web/scripts/auth-live-smoke.mjs` via `AUTH_SMOKE_*` usage.

Maintenance rule:

- When a backend runtime variable is added to `AppConfigService`, also add it to `backend/nestjs/.env.example` and this inventory.
- When a frontend build-time variable is added through `import.meta.env`, also add it to `admin-web/.env.example` and this inventory.
- When an auth smoke variable is added through `AUTH_SMOKE_*`, also add it to this inventory.
- Keep `.env.example` values placeholder-only; do not add real secrets.

Verification:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run test:scripts
```

If this command fails on env drift, update the inventory and committed examples before continuing.

## CODEX Dürüst Yorum

This inventory is useful because it turns "we will configure it later" into a checklist with owners and risk level. The project already has strong release gates; the remaining production risk is mostly environment drift, secret handling, and real provider/source values. This document reduces that drift without pretending the real values are known today.

## Next Logical Step

Use `docs/plans/deployment-runbook-skeleton.md` as the operator flow for the first staging or pilot deploy rehearsal.
