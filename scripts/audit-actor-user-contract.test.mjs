import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");

const userActionAuditFiles = [
  "backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts",
  "backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts",
  "backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts",
  "backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts",
  "backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts",
];

function readText(path) {
  return readFileSync(join(workspaceRoot, path), "utf8");
}

test("user-driven store ops audit events bind actor_user_id in the canonical audit column", () => {
  for (const file of userActionAuditFiles) {
    const text = readText(file);
    assert.doesNotMatch(
      text,
      /INSERT INTO audit\.event_log[\s\S]*?VALUES\s*\(\s*NULL[\s\S]*?actorUserId/g,
      `${file} must not store a real actor only inside metadata_json`,
    );
  }
});
