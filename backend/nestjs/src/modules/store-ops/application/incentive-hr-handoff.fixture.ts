import type { HrSnapshot } from "../infrastructure/incentive-hr-handoff.repository";

export function hrTestSnapshot(companyId = "company-a"): HrSnapshot {
  return {
    packages: [{ company_id: companyId, company_name: "Test Şirket", manager_user_id: "manager-a", package_id: "package-a", package_status: "admin_approved", submitted_at: "2026-09-01", reviewed_at: "2026-09-02", manager_name: "Ayşe Demir", store_ids: ["store-a", "empty-store"], stale_stores: 0 }],
    rows: [{ company_id: companyId, manager_user_id: "manager-a", package_id: "package-a", store_id: "store-a", store_code: "S01", store_name: "Test Mağaza", row_id: "row-a", employee_id: "employee-a", display_name: "=HYPERLINK(\"example.invalid\")", position_code: "SALES_ASSOCIATE", target_amount: "100000.00", actual_sales_amount: "110000.00", achievement_pct: "110.00", applied_rate: "0.0150", payable_amount: "1650.00", final_amount: "1800.25", reason_note: "=1+1" }],
    deliveries: [],
  };
}
