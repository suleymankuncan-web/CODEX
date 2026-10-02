# Admin/HR recent seller code reference

Owner scope: replace the single latest seller code display in the incoming
requests page with the latest ten actual seller codes. This existing reference
is the franchise FM namespace; it is not the latest ten sales transactions.

The bounded database query merges employee references and approved seller-code
requests, deduplicates uppercase codes, and sorts numeric suffixes descending
with a stable code tie-breaker. Inactive employees remain in the namespace;
pending requests do not reserve an approved code here. PostgreSQL numeric and
JavaScript BigInt preserve large suffixes and the existing next-code preview.
The latest code, history and preview now come from one query snapshot.

The additive OpenAPI history property has a ten-item unique upper bound and
remains optional for compatibility with earlier API instances. The browser
falls back to the known latest code when connected to an older instance;
it never invents nine additional records. Existing HR-only endpoint roles,
franchise input validation, approval editing and code allocation remain intact.

Local verification follows the owner instruction to run targeted checks only:
repository/service tests, native disposable PostgreSQL sorting/deduplication,
generated API checks, build/lint, and incoming-request browser tests including
mobile widths and denied Report Viewer access. The oversized OpenAPI generator
schema was moved into its existing domain module and its size cap tightened.
Required GitHub checks must pass before squash merge; no manual proof or deploy.
