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
  assert.match(runner, /ChecklistCommandReadRepository/);
  assert.match(runner, /command region aggregate must exclude managers without active scoped stores/);
  assert.match(runner, /forged legacy role region must not override active assigned store hierarchy/);
  assert.match(runner, /inactive or mismatched hierarchy must be excluded from command region aggregate/);
  assert.match(runner, /AT TIME ZONE 'Europe\/Istanbul'/);
  assert.match(runner, /must wait through its Istanbul local plan day/);
  assert.match(runner, /statusDerivation: \["completed", "missed", "planned", "waiting"\]/);
  assert.match(runner, /generate_series\(1, 200\)/);
  assert.match(runner, /69\.99/);
  assert.match(runner, /69\.50/);
  assert.match(runner, /queryCount === 1/);
  assert.match(runner, /page200Scope\.page\.total === 205/);
  assert.match(runner, /JSON\.stringify\(page200Scope\)\.length < 262_144/);
  assert.match(runner, /Math\.max\(page30Ms, page200Ms, candidateMs\) < 1_200/);
});
