import type { DatabaseService } from "../../../shared/database/database.service";
import { rankingDailyComponentsSql } from "./ranking-daily-components-sql";
import { rankingMonthlyTargetJoinSql } from "./ranking-monthly-target-sql";

/** Reuse canonical physical daily aggregation, never average imported ratios. */
export async function reportWeeklyMetrics(db:DatabaseService,input:{start:string;end:string;storeIds:string[]}) {
  if(!input.storeIds.length) return [];
  return (await db.query<{store_id:string;upt_value:string|null;atv_value:string|null;cr_value:string|null;hg_value:string|null;gsm_value:string|null}>(`
    ${rankingDailyComponentsSql("store","ka.store_id = ANY($4::uuid[])")}, gsm AS (
      SELECT g.store_id,CASE WHEN COUNT(DISTINCT g.business_date)=COUNT(*) AND COUNT(DISTINCT outcome.integration_source_id)=1
        THEN SUM(g.yes_customer_count)::numeric/NULLIF(SUM(g.total_customer_count),0) END AS value
      FROM ops.company_daily_kpi_store_gsm g
      JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id,business_date,operation)
      WHERE g.store_id=ANY($4::uuid[]) AND g.business_date BETWEEN $1::date AND $2::date AND outcome.status='succeeded'
      GROUP BY g.store_id
    )
    SELECT facts.store_id::text,
      (facts.upt_numerator/NULLIF(facts.upt_denominator,0))::text AS upt_value,
      (facts.atv_numerator/NULLIF(facts.atv_denominator,0))::text AS atv_value,
      (facts.cr_numerator/NULLIF(facts.cr_denominator,0))::text AS cr_value,
      CASE WHEN monthly_target.value>0 THEN (facts.achievement/monthly_target.value*100)::text END AS hg_value,
      gsm.value::text AS gsm_value
    FROM facts JOIN ops.store s ON s.store_id=facts.store_id
    ${rankingMonthlyTargetJoinSql({store:"s",startParameter:1,endParameter:2})}
    LEFT JOIN gsm ON gsm.store_id=facts.store_id`,[input.start,input.end,[],input.storeIds])).rows;
}
