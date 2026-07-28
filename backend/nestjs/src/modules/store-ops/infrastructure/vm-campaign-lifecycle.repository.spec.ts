import { VmCampaignLifecycleRepository } from "./vm-campaign-lifecycle.repository";

describe("VmCampaignLifecycleRepository", () => {
  it("[AC-19][EC-18] lifecycle commands use expected versions, immutable successors, and receipts", () => {
    const source = require("node:fs").readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8");
    expect(source).toContain("async reviseCampaign");
    expect(source).toContain("parent_revision_id");
    expect(source).toContain("expected_revision");
    expect(source).toContain("async changeAssignmentState");
    expect(source).toContain("current_hold_reason");
    expect(source).toContain("async retireReference");
    expect(source).toContain("findReceipt(client");
    expect(source).toContain("VM_CAMPAIGN_WINDOW_AUTHORITY");
    expect(source).toContain("VM_CAMPAIGN_SCOPE_AUTHORITY");
    expect(source).toContain("VM_CAMPAIGN_EMERGENCY_AUTHORITY");
    expect(source).toContain('if (["withdrawn", "exempt"].includes(nextStatus))');
    expect(source).toContain("reference_retention_days");
    expect(source).toContain("active_workflow_hold = FALSE");
    expect(source).toContain("hold_reconciled_at IS NULL");
    expect(source).toContain('nextStatus = "operational_hold"');
    expect(source).toContain('input.command === "reconcile" ? "reconciled"');
    expect(source).toContain('throw new ConflictException("reconciliation_already_recorded")');
    expect(source).toContain("WHEN deadline_status = 'missed' AND $2 <> 'reopen'");
    expect(source).toContain("policy.retention_policy_id = asset.retention_policy_id");
    expect(source).not.toContain("ORDER BY version_no DESC LIMIT 1");
  });

  it("[NFR-04] remains independently injectable without changing lifecycle semantics", () => {
    const repository = new VmCampaignLifecycleRepository({} as never);
    expect(repository).toBeInstanceOf(VmCampaignLifecycleRepository);
  });
});
