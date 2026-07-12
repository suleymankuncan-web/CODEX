import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditTargetWriters, targetWriterInventory } from "./rem8-target-writer-inventory.mjs";

const workspaceRoot = join(import.meta.dirname, "..");

// Trace: FR-02, FR-03; NFR-04, NFR-05; AC-01; EC-04.
test("classifies every TARGET request INSERT/UPDATE writer", () => {
  const records = auditTargetWriters(workspaceRoot);
  assert.deepEqual(records.map((record) => record.path), Object.keys(targetWriterInventory).sort());
  assert.deepEqual(records.filter((record) => record.class.startsWith("runtime_")).map((record) => record.class), [
    "runtime_pilot_reference_writer",
    "runtime_ordinary_create_and_approval_writer",
  ]);
});
test("fails closed when a new TARGET writer is not inventoried", () => {
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-rem8-writer-inventory-"));
  try {
    for (const root of ["backend/nestjs/src", "backend/nestjs/scripts", "db/seeds", "scripts"]) {
      mkdirSync(join(directory, root), { recursive: true });
    }
    writeFileSync(
      join(directory, "backend/nestjs/src", "unknown.ts"),
      "INSERT INTO ops.target_distribution_request (target_label) VALUES ('unknown')",
      "utf8",
    );
    assert.throws(() => auditTargetWriters(directory), /unclassified_target_writer/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
