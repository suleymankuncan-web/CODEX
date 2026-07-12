import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const mutationPattern = /(?:INSERT\s+INTO|UPDATE)\s+ops\.target_distribution_request\b/gis;
const scanRoots = ["backend/nestjs/src", "backend/nestjs/scripts", "db/seeds", "scripts"];

export const targetWriterInventory = Object.freeze({
  "backend/nestjs/scripts/database-invariant-preflight-fixture-smoke.ts": {
    class: "diagnostic_fixture", mutationCount: 2,
  },
  "backend/nestjs/scripts/rem8-target-constraint-disposable-rehearsal.ts": {
    class: "rem8_disposable_fixture", mutationCount: 7,
  },
  "backend/nestjs/src/modules/store-ops/infrastructure/pilot-roster-reconciliation.repository.ts": {
    class: "runtime_pilot_reference_writer", mutationCount: 2,
  },
  "backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts": {
    class: "runtime_ordinary_create_and_approval_writer", mutationCount: 2,
  },
  "db/seeds/001_reference_seed.sql": {
    class: "demo_reference_seed", mutationCount: 1,
  },
  "scripts/rem8-target-constraint-disposable-smoke.mjs": {
    class: "rem8_disposable_seed", mutationCount: 2,
  },
  "scripts/dbc5-target-constraint-disposable-smoke.mjs": {
    class: "dbc5_disposable_semantic_fixture", mutationCount: 2,
  },
});

// Trace: FR-02, FR-03; NFR-04, NFR-05; AC-01; EC-04.
export function auditTargetWriters(workspaceRoot) {
  const discovered = {};
  for (const root of scanRoots) {
    const absoluteRoot = join(workspaceRoot, root);
    for (const path of walk(absoluteRoot)) {
      const normalized = relative(workspaceRoot, path).replaceAll("\\", "/");
      if (/\.(?:spec\.ts|test\.mjs)$/.test(normalized)) continue;
      const source = readFileSync(path, "utf8");
      const matches = source.match(mutationPattern) ?? [];
      if (matches.length > 0) discovered[normalized] = matches.length;
    }
  }
  const expectedPaths = Object.keys(targetWriterInventory).sort();
  const discoveredPaths = Object.keys(discovered).sort();
  if (JSON.stringify(expectedPaths) !== JSON.stringify(discoveredPaths)) {
    throw new Error("unclassified_target_writer");
  }
  for (const path of expectedPaths) {
    if (discovered[path] !== targetWriterInventory[path].mutationCount) {
      throw new Error("target_writer_mutation_count_drift");
    }
  }
  return expectedPaths.map((path) => ({
    ...targetWriterInventory[path],
    path,
  }));
}
function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) result.push(...walk(path));
    else result.push(path);
  }
  return result;
}
