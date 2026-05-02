# Dependency Maintenance Notes

## BullMQ uuid override

As of 2026-04-24, the backend keeps this package override:

```json
{
  "overrides": {
    "bullmq": {
      "uuid": "14.0.0"
    }
  }
}
```

Reason:
- `npm audit --omit=dev` reports `uuid <14.0.0` through `bullmq`.
- BullMQ currently uses the `uuid.v4()` API path.
- Runtime smoke confirmed BullMQ can create a queue token with `uuid@14.0.0`.
- Jest uses `test/jest/uuid.cjs` because `uuid@14` is ESM and the current Jest setup runs CommonJS transforms.

Removal rule:
- Re-check this override whenever BullMQ is upgraded.
- Remove the override and the Jest `uuid` mapper when BullMQ's own dependency tree no longer pulls vulnerable `uuid <14.0.0` and the full release check passes without them.

Verification command:

```bash
npm run check:release
```
