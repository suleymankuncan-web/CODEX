SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

-- New projections preserve V1's gross column and all frozen financial history.
ALTER TABLE ops.sales_target_incentive_projection_row
    ADD COLUMN IF NOT EXISTS personnel_net_sales_amount NUMERIC(18,4);
ALTER TABLE rpt.sales_target_incentive_final_row
    DROP CONSTRAINT IF EXISTS sales_target_incentive_final_row_actual_sales_amount_check;

CREATE OR REPLACE FUNCTION ops.guard_incentive_signed_net_v2()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.actual_sales_amount < 0 AND NOT EXISTS (
        SELECT 1 FROM rpt.sales_target_incentive_final_snapshot snapshot
        JOIN ops.sales_target_incentive_rule_version rule
          ON rule.sales_target_incentive_rule_version_id = snapshot.rule_version_id
        WHERE snapshot.sales_target_incentive_final_snapshot_id = NEW.final_snapshot_id
          AND snapshot.rule_version_code = 'sales-target-incentive-v2.0.0'
          AND rule.rule_version_code = snapshot.rule_version_code
    ) THEN
        RAISE EXCEPTION 'Signed incentive sales require the V2 net rule' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS incentive_signed_net_rule ON rpt.sales_target_incentive_final_row;
CREATE TRIGGER incentive_signed_net_rule BEFORE INSERT OR UPDATE OF actual_sales_amount, final_snapshot_id
    ON rpt.sales_target_incentive_final_row FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_signed_net_v2();

INSERT INTO ops.sales_target_incentive_rule_version
    (rule_version_code,status,effective_from,period_timezone,bracket_boundary_policy,
     round_before_lookup,raw_amount_minimum_scale,payable_amount_scale,sub_kurus_policy)
SELECT 'sales-target-incentive-v2.0.0','active',effective_from,period_timezone,bracket_boundary_policy,
    round_before_lookup,raw_amount_minimum_scale,payable_amount_scale,sub_kurus_policy
FROM ops.sales_target_incentive_rule_version WHERE rule_version_code = 'sales-target-incentive-v1.0.0'
ON CONFLICT (rule_version_code) DO NOTHING;

INSERT INTO ops.sales_target_incentive_rate_bracket
    (rule_version_id,rate_table_version,audience,min_achievement_pct,max_achievement_pct,rate,display_label,sort_order)
SELECT current_rule.sales_target_incentive_rule_version_id,bracket.rate_table_version,bracket.audience,
    bracket.min_achievement_pct,bracket.max_achievement_pct,bracket.rate,bracket.display_label,bracket.sort_order
FROM ops.sales_target_incentive_rate_bracket bracket
JOIN ops.sales_target_incentive_rule_version previous_rule
    ON previous_rule.sales_target_incentive_rule_version_id = bracket.rule_version_id
JOIN ops.sales_target_incentive_rule_version current_rule ON current_rule.rule_version_code = 'sales-target-incentive-v2.0.0'
WHERE previous_rule.rule_version_code = 'sales-target-incentive-v1.0.0'
    AND NOT EXISTS (SELECT 1 FROM ops.sales_target_incentive_rate_bracket existing
        WHERE existing.rule_version_id = current_rule.sales_target_incentive_rule_version_id
          AND existing.audience = bracket.audience AND existing.sort_order = bracket.sort_order);

DO $$ BEGIN
    IF (SELECT COUNT(*) FROM ops.sales_target_incentive_rate_bracket bracket
        JOIN ops.sales_target_incentive_rule_version rule ON rule.sales_target_incentive_rule_version_id = bracket.rule_version_id
        WHERE rule.rule_version_code = 'sales-target-incentive-v2.0.0') <> 14 THEN
        RAISE EXCEPTION 'V2 incentive rates must preserve the complete V1 table';
    END IF;
END $$;
