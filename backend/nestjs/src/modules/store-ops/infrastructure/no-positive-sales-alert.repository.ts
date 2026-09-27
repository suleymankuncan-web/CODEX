import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type NoPositiveSalesCandidate = {
  company_id: string;
  store_id: string;
  employee_id: string;
  assignment_id: string;
  period_anchor: string;
  manager_emails: string[];
};

export type ClaimedNoSalesAlert = {
  delivery_id: string;
  recipient_email: string;
  business_date: string;
  store_name: string;
  display_name: string;
};

@Injectable()
export class NoPositiveSalesAlertRepository {
  constructor(private readonly database: DatabaseService) {}

  async hasCompletedLoad(businessDate: string): Promise<boolean> {
    const result = await this.database.query<{ complete: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM ops.company_daily_kpi_component_outcome
        WHERE business_date = $1::date AND status = 'succeeded'
          AND operation IN ('sales', 'footfall', 'gsm')
        GROUP BY integration_source_id
        HAVING COUNT(DISTINCT operation) = 3
      ) AS complete
    `, [businessDate]);
    return result.rows[0]?.complete === true;
  }

  async listCandidates(businessDate: string): Promise<NoPositiveSalesCandidate[]> {
    const result = await this.database.query<NoPositiveSalesCandidate>(`
      WITH completed_source AS (
        SELECT integration_source_id
        FROM ops.company_daily_kpi_component_outcome
        WHERE business_date = $1::date AND status = 'succeeded'
          AND operation IN ('sales', 'footfall', 'gsm')
        GROUP BY integration_source_id
        HAVING COUNT(DISTINCT operation) = 3
      ), covered_store AS (
        SELECT sales.store_id
        FROM ops.company_daily_kpi_store_sales sales
        INNER JOIN ops.company_daily_kpi_component_outcome outcome
          ON outcome.component_outcome_id = sales.component_outcome_id
         AND outcome.operation = 'sales' AND outcome.status = 'succeeded'
        LEFT JOIN completed_source source ON source.integration_source_id = outcome.integration_source_id
        WHERE sales.business_date BETWEEN $1::date - 14 AND $1::date
        GROUP BY sales.store_id
        HAVING COUNT(DISTINCT sales.business_date) = 15
          AND BOOL_OR(sales.business_date = $1::date AND source.integration_source_id IS NOT NULL)
      ), eligible AS (
        SELECT store.company_id, store.store_id, employee.employee_id,
          assignment.assignment_id, assignment.start_date
        FROM covered_store
        INNER JOIN ops.store store ON store.store_id = covered_store.store_id
          AND store.status = 'active' AND store.kpi_import_enabled = TRUE
        INNER JOIN ops.employee_assignment_history assignment ON assignment.store_id = store.store_id
          AND assignment.assignment_status = 'active' AND assignment.is_primary_assignment = TRUE
          AND assignment.start_date <= $1::date - 14
          AND (assignment.end_date IS NULL OR assignment.end_date >= $1::date)
        INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
          AND employee.employment_status = 'active'
        INNER JOIN ops.position position ON position.position_id = assignment.position_id
          AND position.position_code IN ('ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE', 'SHIFT_LEAD')
        WHERE NOT EXISTS (
          SELECT 1 FROM ops.company_daily_kpi_employee_sales person_sales
          INNER JOIN ops.company_daily_kpi_component_outcome outcome
            ON outcome.component_outcome_id = person_sales.component_outcome_id
           AND outcome.operation = 'sales' AND outcome.status = 'succeeded'
          WHERE person_sales.employee_id = employee.employee_id
            AND person_sales.business_date BETWEEN $1::date - 14 AND $1::date
            AND person_sales.sale_invoice_count > 0 AND person_sales.sale_amount_try > 0
        )
      )
      SELECT eligible.company_id::text, eligible.store_id::text,
        eligible.employee_id::text, eligible.assignment_id::text,
        GREATEST(eligible.start_date, COALESCE((
          SELECT MAX(person_sales.business_date)
          FROM ops.company_daily_kpi_employee_sales person_sales
          INNER JOIN ops.company_daily_kpi_component_outcome outcome
            ON outcome.component_outcome_id = person_sales.component_outcome_id
           AND outcome.operation = 'sales' AND outcome.status = 'succeeded'
          WHERE person_sales.employee_id = eligible.employee_id
            AND person_sales.business_date <= $1::date
            AND person_sales.sale_invoice_count > 0 AND person_sales.sale_amount_try > 0
        ), eligible.start_date))::text AS period_anchor,
        ARRAY(
          SELECT DISTINCT account.email
          FROM ops.user_action_store_assignment manager_store
          INNER JOIN ops.user_account account ON account.user_id = manager_store.user_id
            AND account.is_active = TRUE AND account.email IS NOT NULL
          INNER JOIN ops.user_role_assignment manager_role ON manager_role.user_id = account.user_id
            AND manager_role.start_at <= clock_timestamp()
            AND (manager_role.end_at IS NULL OR manager_role.end_at > clock_timestamp())
          INNER JOIN ops.role role ON role.role_id = manager_role.role_id
            AND role.role_code = 'REGION_MANAGER'
          WHERE manager_store.store_id = eligible.store_id
            AND manager_store.start_at <= clock_timestamp()
            AND (manager_store.end_at IS NULL OR manager_store.end_at > clock_timestamp())
        ) AS manager_emails
      FROM eligible
    `, [businessDate]);
    return result.rows;
  }

  async enqueue(input: NoPositiveSalesCandidate & { businessDate: string; recipientEmail: string }) {
    await this.database.query(`
      INSERT INTO ops.no_positive_sales_alert_delivery (
        business_date, company_id, store_id, employee_id, assignment_id,
        period_anchor, recipient_email
      ) VALUES ($1::date, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::date, $7)
      ON CONFLICT (employee_id, assignment_id, period_anchor, recipient_email) DO NOTHING
    `, [input.businessDate, input.company_id, input.store_id, input.employee_id,
      input.assignment_id, input.period_anchor, input.recipientEmail]);
  }

  async markAbandonedClaimsUncertain() {
    await this.database.query(`
      UPDATE ops.no_positive_sales_alert_delivery
      SET status = 'uncertain', updated_at = clock_timestamp()
      WHERE status = 'sending' AND claimed_at < clock_timestamp() - INTERVAL '20 minutes'
    `);
  }

  async listPendingRecipients(): Promise<string[]> {
    const result = await this.database.query<{ recipient_email: string }>(`
      SELECT DISTINCT recipient_email FROM ops.no_positive_sales_alert_delivery
      WHERE status = 'pending' ORDER BY recipient_email LIMIT 100
    `);
    return result.rows.map(row => row.recipient_email);
  }

  async claim(recipientEmail: string): Promise<ClaimedNoSalesAlert[]> {
    const result = await this.database.query<ClaimedNoSalesAlert>(`
      WITH next AS (
        SELECT delivery_id FROM ops.no_positive_sales_alert_delivery
        WHERE status = 'pending' AND recipient_email = $1
        ORDER BY business_date, created_at, delivery_id
        LIMIT 100 FOR UPDATE SKIP LOCKED
      ), claimed AS (
        UPDATE ops.no_positive_sales_alert_delivery delivery
        SET status = 'sending', claimed_at = clock_timestamp(), updated_at = clock_timestamp()
        FROM next WHERE delivery.delivery_id = next.delivery_id
        RETURNING delivery.delivery_id, delivery.recipient_email,
          delivery.business_date, delivery.store_id, delivery.employee_id
      )
      SELECT claimed.delivery_id::text, claimed.recipient_email,
        claimed.business_date::text, store.store_name,
        COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
          employee.external_employee_ref, 'Personel') AS display_name
      FROM claimed
      INNER JOIN ops.store store ON store.store_id = claimed.store_id
      INNER JOIN ops.employee employee ON employee.employee_id = claimed.employee_id
      ORDER BY claimed.business_date, store.store_name, display_name
    `, [recipientEmail]);
    return result.rows;
  }

  async markSent(ids: string[], messageId: string) {
    if (ids.length === 0) return;
    await this.database.query(`
      UPDATE ops.no_positive_sales_alert_delivery
      SET status = 'sent', sent_at = clock_timestamp(), smtp_message_id = $2,
        updated_at = clock_timestamp()
      WHERE delivery_id = ANY($1::uuid[]) AND status = 'sending'
    `, [ids, messageId]);
  }

  async markUncertain(ids: string[]) {
    if (ids.length === 0) return;
    await this.database.query(`
      UPDATE ops.no_positive_sales_alert_delivery
      SET status = 'uncertain', updated_at = clock_timestamp()
      WHERE delivery_id = ANY($1::uuid[]) AND status = 'sending'
    `, [ids]);
  }

  async markRetryable(ids: string[]) {
    if (ids.length === 0) return;
    await this.database.query(`
      UPDATE ops.no_positive_sales_alert_delivery
      SET status = 'pending', claimed_at = NULL, updated_at = clock_timestamp()
      WHERE delivery_id = ANY($1::uuid[]) AND status = 'sending'
    `, [ids]);
  }
}
