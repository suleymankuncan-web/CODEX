import type { Pool } from "pg";

export const fixtureCompany = "00000000-0000-4000-8000-000000000001";

/** Synthetic query fixture, never application seed data. Caller creates an isolated database. */
export async function seedRankingCacheFixture(pool: Pool) {
  await pool.query(`CREATE SCHEMA ops;
    CREATE TABLE ops.store(store_id uuid PRIMARY KEY, company_id uuid, region_id uuid, store_name text, kpi_import_enabled boolean);
    CREATE TABLE ops.region(region_id uuid, region_name text);
    CREATE TABLE ops.kpi_definition(kpi_id int PRIMARY KEY, kpi_code text, kpi_name text);
    CREATE TABLE ops.kpi_actual(kpi_id int, store_id uuid, employee_id uuid, company_id uuid, scope_type text, period_type text, period_start date, period_end date, actual_value numeric, source_type text);
    CREATE TABLE ops.kpi_target(kpi_id int, store_id uuid, scope_type text, period_type text, period_start date, period_end date, target_value numeric);
    CREATE TABLE ops.company_daily_kpi_store_gsm(store_id uuid, component_outcome_id int, business_date date, operation text, yes_customer_count int, total_customer_count int);
    CREATE TABLE ops.company_daily_kpi_component_outcome(component_outcome_id int, business_date date, operation text, status text, integration_source_id int);
    CREATE TABLE ops.user_action_store_assignment(store_id uuid, user_id uuid, start_at timestamptz, end_at timestamptz);
    CREATE TABLE ops.user_role_assignment(user_id uuid, role_id int, start_at timestamptz, end_at timestamptz);
    CREATE TABLE ops.role(role_id int, role_code text);
    CREATE TABLE ops.user_account(user_id uuid, employee_id uuid, username text, email text, is_active boolean);
    CREATE TABLE ops.employee(employee_id uuid PRIMARY KEY, first_name text, last_name text);
    CREATE TABLE ops.employee_assignment_history(employee_id uuid, position_id int, assignment_status text, is_primary_assignment boolean, start_date date);
    CREATE TABLE ops.position(position_id int, position_code text);
    CREATE TABLE ops.personnel_target_reference(employee_id uuid, store_id uuid, target_value numeric, period_start date, period_end date, target_type text, status text);
    INSERT INTO ops.store SELECT md5('store-'||s)::uuid,'${fixtureCompany}',NULL,'Store '||s,true FROM generate_series(1,100) s;
    INSERT INTO ops.employee SELECT md5('employee-'||e)::uuid,'Fixture','Employee '||e FROM generate_series(1,800) e;
    INSERT INTO ops.position VALUES (1,'SALES_ASSOCIATE');
    INSERT INTO ops.employee_assignment_history SELECT employee_id,1,'active',true,'2026-01-01' FROM ops.employee;
    INSERT INTO ops.kpi_definition VALUES (1,'NET_SALES','Sales'),(2,'ITEM_COUNT','Items'),(3,'TICKET_COUNT','Tickets'),(4,'FF','Traffic'),(5,'ATV','ATV'),(6,'UPT','UPT'),(7,'CR','CR'),(8,'TARGET_ACHIEVEMENT','HG'),(9,'gsm_approval','GSM');
    INSERT INTO ops.kpi_actual SELECT metric,md5('store-'||s)::uuid,NULL,'${fixtureCompany}','store','daily',day::date,day::date,
      CASE metric WHEN 1 THEN (10000+s*10)*8 WHEN 2 THEN 40*8 WHEN 3 THEN 20*8 ELSE 200*8 END,'company'
      FROM generate_series(1,100) s CROSS JOIN generate_series(1,4) metric CROSS JOIN generate_series('2026-09-01'::date,'2026-09-15'::date,interval '1 day') day;
    INSERT INTO ops.kpi_actual SELECT metric,md5('store-'||((e-1)/8+1))::uuid,md5('employee-'||e)::uuid,'${fixtureCompany}','employee','daily',day::date,day::date,
      CASE metric WHEN 1 THEN 10000+e*10 WHEN 2 THEN 40 WHEN 3 THEN 20 ELSE 200 END,'company'
      FROM generate_series(1,800) e CROSS JOIN generate_series(1,4) metric CROSS JOIN generate_series('2026-09-01'::date,'2026-09-15'::date,interval '1 day') day;
    INSERT INTO ops.kpi_target SELECT 1,store_id,'store','daily',day::date,day::date,100000 FROM ops.store CROSS JOIN generate_series('2026-09-01'::date,'2026-09-30'::date,interval '1 day') day;
    INSERT INTO ops.personnel_target_reference SELECT md5('employee-'||e)::uuid,md5('store-'||((e-1)/8+1))::uuid,400000,'2026-09-01','2026-09-30','monthly_sales_target','approved' FROM generate_series(1,800) e;
    CREATE INDEX ON ops.kpi_actual(kpi_id,scope_type,company_id,store_id,employee_id,period_start,period_end);
    CREATE INDEX ON ops.kpi_target(kpi_id,store_id,period_type,period_start,period_end);
    CREATE INDEX ON ops.personnel_target_reference(employee_id,store_id,period_start,period_end);
    CREATE INDEX ON ops.employee_assignment_history(employee_id);
    ANALYZE;`);
}
