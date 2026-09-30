export type SalesTargetIncentiveAdjustmentSummaryRow = {
  store_id: string;
  employee_id: string;
  participant_type: "store_manager" | "personnel";
  final_row_id?: string | null;
  final_snapshot_id?: string | null;
  rule_version_code?: string | null;
  participation?: import("./incentive-participation-finance.sql").FinancialParticipation | null;
  participation_only?: boolean;
  employee_display_name?: string | null;
  current_employment_status?: "active" | "inactive" | "terminated" | null;
  termination_date?: string | null;
  position_code?: string | null;
  normalized_from_position_code?: string | null;
  rate_table_version?: string | null;
  target_amount?: string | null;
  actual_sales_amount?: string | null;
  achievement_pct?: string | null;
  applied_rate?: string | null;
  raw_earned_amount?: string | null;
  payable_amount?: string | null;
  calculation_status?: string | null;
  correction_amount: string;
  adjustment_amount: string;
  approved_adjustment_count?: number;
  latest_approved_adjustment_at?: string | null;
  final_amount: string | null;
};

