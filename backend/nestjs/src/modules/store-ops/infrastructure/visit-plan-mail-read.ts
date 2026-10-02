import { createHash } from 'node:crypto';
import type { DatabaseService } from '../../../shared/database/database.service';
import { dateShift,istanbulClock } from '../../../shared/mail/pilot-periods';
import type { OperationalMailEvent } from './operational-mail.types';
export const visitPlanRecipient='oguzcanakgun@lufian.com.tr';
export type VisitPlanMailData={managerName:string;weekStart:string;items:{plannedDate:string;storeCode:string;storeName:string}[];scopeRevision:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readVisitPlanMail(db:DatabaseService,event:OperationalMailEvent,now=new Date()):Promise<VisitPlanMailData|null> {
  const {weekStart,userId,storeIds,revisionIds}=event.payload;
  if(typeof weekStart!=='string' || typeof userId!=='string' || !uuid.test(userId) || userId!==event.entity_id
    || !Array.isArray(storeIds) || !storeIds.length || !storeIds.every(id=>typeof id==='string' && uuid.test(id))
    || !Array.isArray(revisionIds) || !revisionIds.length || !revisionIds.every(id=>typeof id==='string' && uuid.test(id)))return null;
  try {dateShift(weekStart,0);if(new Date(weekStart).getUTCDay()!==1 || dateShift(weekStart,6)<istanbulClock(now).date)return null;} catch {return null;}
  const result=await db.query<{manager_name:string;current_store_ids:string[];items:VisitPlanMailData['items']}>(`WITH scope AS (
    SELECT * FROM ops.visit_plan_mail_scope_v1($1::uuid)
  ) SELECT COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',account.first_name,account.last_name)),''),
      NULLIF(BTRIM(CONCAT_WS(' ',employee.first_name,employee.last_name)),''),'Kullanıcı') AS manager_name,
    ARRAY(SELECT store_id::text FROM scope ORDER BY store_id) AS current_store_ids,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('plannedDate',to_char(item.planned_date,'DD.MM.YYYY'),
      'storeCode',store.store_code,'storeName',store.store_name) ORDER BY item.planned_date,item.display_order,store.store_name,item.store_id)
      FROM ops.region_weekly_visit_plan_item item JOIN ops.region_weekly_visit_plan_revision revision USING(revision_id)
      JOIN scope ON scope.store_id=item.store_id AND scope.region_id=item.region_id
      JOIN ops.store store ON store.store_id=item.store_id
      WHERE revision.revision_id=ANY($4::uuid[]) AND revision.week_start_date=$2::date AND revision.visit_type='BM_STORE_VISIT'
        AND item.store_id=ANY($3::uuid[])), '[]'::jsonb) AS items
    FROM ops.user_account account LEFT JOIN ops.employee employee USING(employee_id)
    WHERE account.user_id=$1::uuid AND account.is_active
      AND NOT EXISTS(SELECT 1 FROM unnest($3::uuid[]) saved(store_id) WHERE NOT EXISTS(SELECT 1 FROM scope WHERE scope.store_id=saved.store_id))
      AND (SELECT COUNT(*) FROM ops.region_weekly_visit_plan_revision WHERE revision_id=ANY($4::uuid[])
        AND week_start_date=$2::date AND visit_type='BM_STORE_VISIT')=cardinality($4::uuid[])`,[userId,weekStart,storeIds,revisionIds]);
  const row=result.rows[0];if(!row)return null;
  return {managerName:row.manager_name,weekStart,items:row.items,
    scopeRevision:createHash('sha256').update(JSON.stringify(row.current_store_ids)).digest('hex')};
}
