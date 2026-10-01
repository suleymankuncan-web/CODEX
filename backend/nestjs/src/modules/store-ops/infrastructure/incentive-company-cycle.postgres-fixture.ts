import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Pool, PoolClient } from "pg";

export const cycleId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const cyclePeriod = "2026-05";
export function cycleDatabase(pool: Pool, hooks?: { beforeQuery?: (sql: string, client: PoolClient) => Promise<void>; beforeCommit?: () => Promise<void> }) {
  return {
    query: (sql: string, parameters?: unknown[]) => pool.query(sql, parameters),
    withTransaction: async (work: (client: Pick<PoolClient,"query">) => Promise<unknown>) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work({ query: async (sql: string, parameters?: unknown[]) => {
          await hooks?.beforeQuery?.(sql,client); return client.query(sql,parameters);
        } } as Pick<PoolClient,"query">);
        await hooks?.beforeCommit?.(); await client.query("COMMIT"); return result;
      } catch(error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}

// Production schema and migration, including immutable snapshots, real FKs and cascades.
// This fixture is called only against the suite's owned random disposable database.
export async function seedCompanyCycle(pool: Pool, options?: { legacyEvidence?: boolean }) {
  const schema = readFileSync(resolve(process.cwd(),"../../db/schema.sql"),"utf8");
  await pool.query("DROP SCHEMA IF EXISTS ops,rpt,stg,audit CASCADE");
  await pool.query(schema.slice(0,schema.indexOf("-- Company incentive cycle v1.")));
  const id = cycleId;
  await pool.query(`
    INSERT INTO ops.company(company_id,company_code,company_name) VALUES ('${id(1)}','SYNTHETIC','Synthetic Company'),('${id(9)}','OTHER','Other Synthetic');
    INSERT INTO ops.region(region_id,company_id,region_code,region_name) VALUES('${id(6)}','${id(1)}','R','Synthetic Region');
    INSERT INTO ops.store(store_id,company_id,region_id,store_code,store_name,store_type)
      VALUES('${id(2)}','${id(1)}','${id(6)}','S1','Synthetic Store 1','company'),('${id(3)}','${id(1)}','${id(6)}','S2','Synthetic Store 2','company');
    INSERT INTO ops.position(position_id,company_id,position_code,position_name) VALUES('${id(8)}','${id(1)}','SALES_ASSOCIATE','Sales Associate');
    INSERT INTO ops.employee(employee_id,company_id,first_name,last_name,hire_date,employment_type)
      VALUES('${id(10)}','${id(1)}','Included','One','2020-01-01','full_time'),('${id(11)}','${id(1)}','Included','Two','2020-01-01','full_time'),
        ('${id(12)}','${id(1)}','Norm','Only','2020-01-01','full_time');
    INSERT INTO ops.employee_assignment_history(employee_id,store_id,region_id,position_id,start_date)
      VALUES('${id(10)}','${id(2)}','${id(6)}','${id(8)}','2020-01-01'),('${id(11)}','${id(3)}','${id(6)}','${id(8)}','2020-01-01'),('${id(12)}','${id(2)}','${id(6)}','${id(8)}','2020-01-01');
    INSERT INTO ops.user_account(user_id,username,email) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      'synthetic-'||n,'synthetic-'||n||'@example.test' FROM generate_series(20,26) n;
    INSERT INTO ops.role(role_id,role_code,role_name,role_scope_type) VALUES('${id(70)}','REGION_MANAGER','RM','region'),('${id(71)}','REPORT_VIEWER','Viewer','company'),('${id(72)}','HR_ADMIN','HR','company');
    INSERT INTO ops.user_role_assignment(user_role_assignment_id,user_id,role_id,company_id,scope_type,start_at)
      VALUES('${id(120)}','${id(20)}','${id(70)}','${id(1)}','company','2020-01-01'),('${id(121)}','${id(21)}','${id(70)}','${id(1)}','company','2020-01-01'),
        ('${id(122)}','${id(22)}','${id(71)}','${id(1)}','company','2020-01-01'),('${id(123)}','${id(23)}','${id(72)}','${id(1)}','company','2020-01-01'),
        ('${id(124)}','${id(24)}','${id(71)}','${id(1)}','company','2020-01-01'),('${id(125)}','${id(25)}','${id(72)}','${id(1)}','company','2020-01-01');
    INSERT INTO ops.user_action_store_assignment(user_id,store_id,start_at) VALUES('${id(20)}','${id(2)}','2020-01-01'),('${id(21)}','${id(3)}','2020-01-01');
    INSERT INTO ops.user_permission_assignment(user_role_assignment_id,user_id,permission_id,scope_type,company_id,starts_at,granted_by_user_id,grant_reason)
      SELECT ura.user_role_assignment_id,ura.user_id,p.permission_id,'company','${id(1)}','2020-01-01','${id(26)}','Synthetic capability'
      FROM ops.user_role_assignment ura JOIN ops.permission p ON p.permission_code=CASE ura.user_id
        WHEN '${id(22)}' THEN 'INCENTIVE_SALES_DIRECTOR_APPROVAL' WHEN '${id(23)}' THEN 'INCENTIVE_HR_APPROVAL'
        WHEN '${id(24)}' THEN 'INCENTIVE_GENERAL_MANAGER_APPROVAL' WHEN '${id(25)}' THEN 'INCENTIVE_PAYROLL_DELIVERY' ELSE '' END;
    INSERT INTO ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id,rule_version_code,effective_from)
      VALUES('${id(60)}','synthetic-v1','2020-01-01');
    INSERT INTO ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id,company_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,status,completed_at,source_evidence)
      VALUES('${id(61)}','${id(1)}','2026-05','2026-05-01','2026-05-31','2026-06-01','${id(60)}','succeeded','2026-06-01',
        jsonb_build_object('ownershipRevision',ops.store_ownership_revision_v1('${id(1)}'))),
        ('${id(62)}','${id(1)}','2026-05','2026-05-01','2026-05-31','2026-06-02','${id(60)}','succeeded','2026-06-02',
        jsonb_build_object('ownershipRevision',ops.store_ownership_revision_v1('${id(1)}')));
    INSERT INTO rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id,close_run_id,company_id,region_id,store_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,rule_version_code,manager_rate_table_version,personnel_rate_table_version)
      VALUES('${id(30)}','${id(61)}','${id(1)}','${id(6)}','${id(2)}','2026-05','2026-05-01','2026-05-31','2026-06-01','${id(60)}','synthetic-v1','m-v1','p-v1'),
        ('${id(31)}','${id(62)}','${id(1)}','${id(6)}','${id(3)}','2026-05','2026-05-01','2026-05-31','2026-06-02','${id(60)}','synthetic-v1','m-v1','p-v1');
    INSERT INTO rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id,final_snapshot_id,employee_id,participant_type,position_code,rate_table_version,target_amount,actual_sales_amount,payable_amount,final_amount)
      VALUES('${id(40)}','${id(30)}','${id(10)}','personnel','SALES_ASSOCIATE','p-v1',1000,1200,100,100),
        ('${id(41)}','${id(31)}','${id(11)}','personnel','SALES_ASSOCIATE','p-v1',1000,1200,100,100);
    INSERT INTO ops.sales_target_incentive_store_review(sales_target_incentive_store_review_id,company_id,region_id,store_id,final_snapshot_id,period_key,review_status,reviewed_by_user_id,reviewed_at)
      VALUES('${id(50)}','${id(1)}','${id(6)}','${id(2)}','${id(30)}','2026-05','reviewed','${id(20)}','2026-06-02'),
        ('${id(51)}','${id(1)}','${id(6)}','${id(3)}','${id(31)}','2026-05','reviewed','${id(21)}','2026-06-02');
    INSERT INTO ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id,company_id,package_scope,manager_user_id,period_key,submitted_by_user_id,submitted_at)
      VALUES('${id(80)}','${id(1)}','manager_assignment','${id(20)}','2026-05','${id(20)}','2026-06-03'),
        ('${id(81)}','${id(1)}','manager_assignment','${id(21)}','2026-05','${id(21)}','2026-06-03');
    INSERT INTO ops.sales_target_incentive_region_package_store(region_package_id,store_review_id,company_id,region_id,store_id,final_snapshot_id,period_key,reviewed_by_user_id,reviewed_at)
      VALUES('${id(80)}','${id(50)}','${id(1)}','${id(6)}','${id(2)}','${id(30)}','2026-05','${id(20)}','2026-06-02'),
        ('${id(81)}','${id(51)}','${id(1)}','${id(6)}','${id(3)}','${id(31)}','2026-05','${id(21)}','2026-06-02');
    INSERT INTO ops.sales_target_incentive_region_correction(sales_target_incentive_region_correction_id,region_package_id,company_id,region_id,store_id,employee_id,participant_type,final_row_id,period_key,before_amount,final_amount,reason_note,correction_status,created_by_user_id,submitted_by_user_id,submitted_at)
      VALUES('${id(90)}','${id(80)}','${id(1)}','${id(6)}','${id(2)}','${id(10)}','personnel','${id(40)}','2026-05',100,125,'Synthetic proposal','submitted','${id(20)}','${id(20)}','2026-06-03');
    INSERT INTO ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id,company_id,region_id,package_scope,manager_user_id,period_key,package_status,submitted_by_user_id,reviewed_by_user_id,reviewed_at)
      VALUES('${id(82)}','${id(1)}','${id(6)}','legacy_region',NULL,'2026-04','admin_approved','${id(20)}','${id(22)}','2026-05-02'),
        ('${id(83)}','${id(1)}',NULL,'manager_assignment','${id(21)}','2026-04','admin_approved','${id(21)}','${id(22)}','2026-05-02');
  `);
  if (options?.legacyEvidence) await pool.query(`
    INSERT INTO ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id,company_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,status,completed_at,source_evidence)
      VALUES('${id(64)}','${id(1)}','2026-04','2026-04-01','2026-04-30','2026-05-01','${id(60)}','succeeded','2026-05-01',jsonb_build_object('ownershipRevision',ops.store_ownership_revision_v1('${id(1)}')));
    INSERT INTO rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id,close_run_id,company_id,region_id,store_id,period_key,period_start,period_end,close_cutoff_at,rule_version_id,rule_version_code,manager_rate_table_version,personnel_rate_table_version)
      VALUES('${id(32)}','${id(64)}','${id(1)}','${id(6)}','${id(2)}','2026-04','2026-04-01','2026-04-30','2026-05-01','${id(60)}','synthetic-v1','m-v1','p-v1'),
        ('${id(33)}','${id(64)}','${id(1)}','${id(6)}','${id(3)}','2026-04','2026-04-01','2026-04-30','2026-05-01','${id(60)}','synthetic-v1','m-v1','p-v1');
    INSERT INTO rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id,final_snapshot_id,employee_id,participant_type,position_code,rate_table_version,target_amount,actual_sales_amount,payable_amount,final_amount)
      VALUES('${id(42)}','${id(32)}','${id(10)}','personnel','SALES_ASSOCIATE','p-v1',1000,1200,100,100),
        ('${id(43)}','${id(33)}','${id(11)}','personnel','SALES_ASSOCIATE','p-v1',1000,1200,100,100);
    INSERT INTO ops.sales_target_incentive_store_review(sales_target_incentive_store_review_id,company_id,region_id,store_id,final_snapshot_id,period_key,review_status,reviewed_by_user_id,reviewed_at)
      VALUES('${id(52)}','${id(1)}','${id(6)}','${id(2)}','${id(32)}','2026-04','reviewed','${id(20)}','2026-05-01'),
        ('${id(53)}','${id(1)}','${id(6)}','${id(3)}','${id(33)}','2026-04','reviewed','${id(21)}','2026-05-01');
    INSERT INTO ops.sales_target_incentive_region_package_store(region_package_id,store_review_id,company_id,region_id,store_id,final_snapshot_id,period_key,reviewed_by_user_id,reviewed_at)
      VALUES('${id(82)}','${id(52)}','${id(1)}','${id(6)}','${id(2)}','${id(32)}','2026-04','${id(20)}','2026-05-01'),
        ('${id(83)}','${id(53)}','${id(1)}','${id(6)}','${id(3)}','${id(33)}','2026-04','${id(21)}','2026-05-01');
    INSERT INTO ops.sales_target_incentive_adjustment(sales_target_incentive_adjustment_id,company_id,region_id,store_id,employee_id,final_row_id,rule_version_id,period_key,adjustment_scope,adjustment_type,adjustment_amount,before_amount,after_amount,reason_code,reason_note,status,evidence,created_by_user_id,approved_by_user_id,approved_at)
      VALUES('${id(100)}','${id(1)}','${id(6)}','${id(2)}','${id(10)}','${id(42)}','${id(60)}','2026-04','final_snapshot','manual_adjustment',5,100,105,'historical','Synthetic actual historical approval','approved','{"source":"historical_approval"}','${id(26)}','${id(22)}','2026-05-02');
    INSERT INTO ops.incentive_hr_delivery(company_id,period_key,created_by_user_id,preview_version,recipients,attachment_sha256,status,created_at)
      VALUES('${id(1)}','2026-04','${id(22)}',repeat('c',64),ARRAY['historical@example.test'],repeat('b',64),'uncertain','2026-05-03');
  `);
  await pool.query(readFileSync(resolve(process.cwd(),"../../db/migrations/095_incentive_company_cycle_v1.sql"),"utf8"));
  await pool.query(readFileSync(resolve(process.cwd(),"../../db/migrations/096_store_aware_kpi_returns_v2.sql"),"utf8"));
  await pool.query(readFileSync(resolve(process.cwd(),"../../db/migrations/100_incentive_approval_mail_v1.sql"),"utf8"));
  await pool.query(readFileSync(resolve(process.cwd(),"../../db/migrations/102_incentive_manager_scope_v1.sql"),"utf8"));
}
