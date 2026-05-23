import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/050_pilot_feedback_loop_v1.sql"),
  "utf8",
);

function expectPilotFeedbackShape(sql: string): void {
  expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? ops\.pilot_feedback\s*\(/);
  expect(sql).toContain("pilot_feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
  expect(sql).toContain("actor_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
  expect(sql).toContain("actor_role_codes TEXT[] NOT NULL DEFAULT '{}'::text[]");
  expect(sql).toContain("feedback_type TEXT NOT NULL");
  expect(sql).toContain("severity_suggestion TEXT NOT NULL");
  expect(sql).toContain("route_path TEXT NOT NULL");
  expect(sql).toContain("status TEXT NOT NULL DEFAULT 'new'");
  expect(sql).toContain("classification TEXT");
  expect(sql).toContain("classified_by_user_id UUID REFERENCES ops.user_account(user_id)");
  expect(sql).toContain("CHECK (feedback_type IN ('bug', 'friction', 'idea', 'data_quality', 'other'))");
  expect(sql).toContain("CHECK (severity_suggestion IN ('p0', 'p1', 'p2', 'p3'))");
  expect(sql).toContain("CHECK (status IN ('new', 'triaged', 'parked', 'resolved'))");
  expect(sql).toContain(
    "CHECK (classification IS NULL OR classification IN ('p0_stop', 'p1_pilot_blocker', 'p2_pilot_friction', 'p3_backlog'))",
  );
}

function expectPilotFeedbackIndexes(sql: string): void {
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status_created");
  expect(sql).toContain("ON ops.pilot_feedback (status, created_at DESC)");
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_pilot_feedback_classification_created");
  expect(sql).toContain("ON ops.pilot_feedback (classification, created_at DESC)");
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_pilot_feedback_actor_created");
  expect(sql).toContain("ON ops.pilot_feedback (actor_user_id, created_at DESC)");
}

describe("pilot feedback schema contract", () => {
  it("defines controlled pilot feedback intake in canonical schema and migration", () => {
    expectPilotFeedbackShape(schemaSql);
    expectPilotFeedbackShape(migrationSql);
  });

  it("keeps classification constraints and lookup indexes aligned", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CHECK (status <> 'triaged' OR classification IS NOT NULL)");
      expect(sql).toContain("CHECK (classified_at IS NULL OR classified_by_user_id IS NOT NULL)");
      expectPilotFeedbackIndexes(sql);
    }
  });

  it("documents that feedback does not change pilot go no-go semantics", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain(
        "COMMENT ON TABLE ops.pilot_feedback IS 'Controlled pilot feedback intake for classifying P0/P1/P2/P3 findings without changing pilot go/no-go semantics.'",
      );
    }
  });
});
