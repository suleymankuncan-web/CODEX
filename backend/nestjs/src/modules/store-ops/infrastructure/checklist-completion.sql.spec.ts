import { checklistCompletionSql } from "./checklist-completion.sql";

describe("checklistCompletionSql", () => {
  it("keeps N/A outside score, compliance, and required evidence", () => {
    expect(checklistCompletionSql).toContain("cr.response_value IS DISTINCT FROM 'not_applicable'");
    expect(checklistCompletionSql).toContain("cti.response_type <> 'compliance'");
    expect(checklistCompletionSql).toContain("cti.response_type = 'compliance'");
    expect(checklistCompletionSql).toContain("AVG(scoring.score_ratio)");
    expect(checklistCompletionSql).toContain("WHEN 'partially_compliant' THEN 0.5");
    expect(checklistCompletionSql).not.toContain("WHEN COALESCE(cr.score_value, 0) > 0 THEN 1");
    expect(checklistCompletionSql).toMatch(/evidence_policy = 'required'[\s\S]*response_value IS DISTINCT FROM 'not_applicable'/);
  });

  it("allows a null score when every applicable denominator is removed", () => {
    expect(checklistCompletionSql).toContain("/ NULLIF(");
    expect(checklistCompletionSql).not.toContain("COALESCE(\n        (");
  });
});
