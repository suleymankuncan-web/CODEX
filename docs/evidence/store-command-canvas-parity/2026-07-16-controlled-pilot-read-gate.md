# Store Command Canvas controlled-pilot read gate

Date: 2026-07-16
Environment: protected staging
Decision: `PASS_CONTROLLED_PILOT_READ_ONLY`

## Runtime transition

The staging API health endpoint returned `200`. Unauthenticated probes for the
two protected workspace contracts returned `403`, proving that the deployed
runtime owns the routes and requires authentication rather than returning the
former `404` route absence.

| Read contract | Unauthenticated route-presence probe |
|---|---:|
| `/api/store/incentives/workspace` | `403` |
| `/api/store/targets/workspace` | `403` |

## Sanitized persona proof

The versioned browser-cookie smoke ran with
`AUTH_SMOKE_PRODUCT_READ_ONLY=1`. It skipped the negative CSRF POST probe and
observed every Incentives and Targets request, so the proof performed no
product mutation.

| Persona | Company scopes | Assigned stores | Read routes | Period | Mutation requests | 390 px overflow |
|---|---:|---:|---|---|---:|---:|
| Region Manager | 1 | 30 | Incentives and Targets | `2026-07` | 0 | no |
| Report Viewer | 1 | 0 | Incentives and Targets | `2026-07` | 0 | no |
| Store Manager | 1 | 1 | Targets only | `2026-07` | 0 | no |

The rendered role-specific headings were:

- Region Manager: `Prim Kontrol Merkezi` and `Hedef Kontrol Masası`;
- Report Viewer: `Şirket Prim Görünümü` and `Şirket hedef görünümü`;
- Store Manager: `Mağaza Hedef Dağılımı`.

Every workspace response used by the page returned `200` with a real period
projection. Store Manager Incentives was not opened or exposed by this proof.
Report Viewer remained company-scoped and read-only throughout both routes.

## Session and transport proof

All three personas proved:

- authentication status `200` with the expected application role;
- browser-session creation `201` and logout clear `200`;
- an HttpOnly, Secure, SameSite=Lax, host-only application cookie;
- no application-stored bearer token or provider ID token;
- no token-shaped storage keys;
- logout removed the application cookie.

Credentials, one-time codes, subject identifiers, cookie values, raw UUIDs,
business payloads and workspace records are intentionally excluded.

## Decision boundary

This receipt proves the required protected-staging, read-only controlled-pilot
gate for the Store Command Canvas Incentives and Targets cutover. It does not
authorize broad production, provider changes, staging mutation, DDL, DML or a
production deployment.
