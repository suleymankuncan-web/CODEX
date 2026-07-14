import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wrapper = readFileSync(new URL("./checklist-visit-plan-api-postgres-smoke.mjs", import.meta.url), "utf8");
const runner = readFileSync(
  new URL("../backend/nestjs/scripts/checklist-visit-plan-api-postgres-smoke.ts", import.meta.url),
  "utf8",
);

test("visit plan API smoke is disposable and covers the locked concurrency/data gates", () => {
  assert.match(wrapper, /store_ops_fresh_migration_smoke/);
  assert.match(wrapper, /NODE_ENV === "production"/);
  assert.match(wrapper, /smoke:migration:fresh-db/);
  assert.match(runner, /Promise\.allSettled/);
  assert.match(runner, /parsedDatabaseUrl\.hostname/);
  assert.match(runner, /\^store_ops_fresh_migration_smoke/);
  assert.match(runner, /currentRevisions === 1/);
  assert.match(runner, /same-key replay must not add a revision/);
  assert.match(runner, /cross-region snapshot/);
  assert.match(runner, /AT TIME ZONE 'Europe\/Istanbul'/);
  assert.match(runner, /must wait through its Istanbul local plan day/);
  assert.match(runner, /statusDerivation: \["completed", "missed", "waiting"\]/);
});
