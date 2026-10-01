import type { PoolClient } from 'pg';
import { StorePositiveSellersReadRepository } from './store-positive-sellers-read.repository';
/** Supplemental drawer amounts are archived with the approval; they never change the payout base. */
export async function companySalesEvidence(client:Pick<PoolClient,'query'>,storeIds:string[],period:string) {
  const start=`${period}-01`,end=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5)),0)).toISOString().slice(0,10);
  // Reuse the accepted V2 seller attribution query on this transaction's client.
  const reader=new StorePositiveSellersReadRepository({query:async (sql,params)=>client.query(sql,params)});
  const people=(await reader.list({storeIds,periodStart:start,throughDate:end})).filter(row=>row.employee_id && row.net_amount!==null)
    .map(row=>({storeId:row.store_id,employeeId:row.employee_id,gross:row.sale_amount,returns:row.return_amount,net:row.net_amount}));
  const stores=(await client.query<{storeId:string;gross:string;returns:string;net:string}>(`SELECT fact.store_id::text AS "storeId",
    SUM(fact.sale_amount_try)::text AS gross,SUM(fact.signed_return_amount_try)::text AS returns,SUM(ROUND(fact.net_amount_try,4))::text AS net
    FROM ops.company_daily_kpi_store_sales fact JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
    WHERE fact.store_id=ANY($1::uuid[]) AND fact.business_date BETWEEN $2::date AND $3::date AND outcome.status='succeeded' AND outcome.operation='sales'
    GROUP BY fact.store_id HAVING BOOL_AND(outcome.return_attribution_version=2) AND COUNT(DISTINCT fact.business_date)=COUNT(*)`,[storeIds,start,end])).rows;
  return {people,stores};
}
