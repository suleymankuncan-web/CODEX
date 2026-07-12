# B1 Moi Ranking And Profile Scope Evidence - 2026-07-13

Status: partial_mixed_pass
Shelf: evidence
Evidence class: sanitized_live_session_plus_local_contract
Observed at: 2026-07-13T00:18:55+03:00

## Decision

The owner approved the Store Personnel pilot account, linked to Moi Suleyman
Ozturk, as the positive reference subject and confirmed that the same subject
belongs to the pilot Store Manager's store. No P0/P1 scope leak was reproduced;
the decision is `no_runtime_change`.

Current live staging cookie-session evidence proves that the Store Personnel
account lands on `/store/me` with one assigned store and that the linked Store
Manager has one assigned store. The following current frontend authorization
contracts were then rerun against the reviewed application code:

```text
npm.cmd --prefix admin-web run test:e2e -- store-personnel-persona.spec.ts store-manager-persona.spec.ts store-surfaces.spec.ts -g "store personnel lands on personal performance|store manager critical pages keep correct workflow boundaries|store rankings keeps non-privileged rows summary-only and backend-gated|store rankings personnel detail opens the selected personnel performance profile|region manager rankings opens only in-region personnel profile actions"
```

Result: `5/5` passed.

## Proven Boundary

- Store Personnel lands on the personal performance surface and sees only
  personnel navigation.
- Non-privileged ranking rows remain summary-only and do not issue a personnel
  performance request when `canOpenProfile` is false.
- Store Manager personnel detail navigation uses the selected, backend-gated
  personnel row.
- Region Manager profile actions appear only for in-region rows.
- Direct denied profile responses hide backend denial details and identifiers;
  that separate targeted contract also passed `2/2` in the preceding run.

## Limit

No second real personnel record was opened. Therefore this receipt does not
claim a fresh live cross-person direct-route denial. It combines current live
persona/session/landing proof with current executable row-scope contracts. A
future live cross-person test still requires a separately approved negative
subject; random real personnel must not be selected.

No credential, OTP, token, cookie value, employee identifier, or personal
business payload is recorded here.
