import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { hrGrantSql, hrPackagesSql, hrRowsSql } from "./incentive-hr-handoff.sql";

export type HrPackageRow = { company_id: string; company_name: string; manager_user_id: string | null; package_id: string | null; package_status: string | null; submitted_at: string | null; reviewed_at: string | null; manager_name: string; store_ids: string[]; stale_stores: number };
export type HrExportRow = { company_id: string; manager_user_id: string; package_id: string; store_id: string; store_code: string; store_name: string; row_id: string; employee_id: string; display_name: string | null; position_code: string; target_amount: string | null; actual_sales_amount: string | null; achievement_pct: string | null; applied_rate: string | null; payable_amount: string; final_amount: string; reason_note: string | null };
export type HrDeliveryRow = { company_id: string; delivery_id: string; status: "sending" | "sent" | "uncertain"; created_at: string; sent_at: string | null };
export type HrSnapshot = { packages: HrPackageRow[]; rows: HrExportRow[]; deliveries: HrDeliveryRow[] };
export type HrDeliveryConfig = { companyId: string; recipients: string[] };

export function hrSnapshotVersion(period: string, snapshot: HrSnapshot, config: HrDeliveryConfig[]) {
  return createHash("sha256").update(JSON.stringify({ period, packages: snapshot.packages, rows: snapshot.rows, recipients: config })).digest("hex");
}

export function hrSnapshotReady(snapshot: HrSnapshot) {
  const storeIds = snapshot.packages.flatMap(item => item.store_ids);
  return snapshot.packages.length > 0 && storeIds.length === new Set(storeIds).size &&
    snapshot.packages.every(item => item.manager_user_id && item.package_status === "admin_approved" && item.store_ids.length > 0 && item.stale_stores === 0);
}

@Injectable()
export class IncentiveHrHandoffRepository {
  constructor(private readonly database: DatabaseService) {}

  async read(period: string, companyIds: string[]): Promise<HrSnapshot> {
    return this.database.withTransaction(async client => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      return this.readSnapshot(client, period, companyIds);
    });
  }

  async claim(input: { period: string; companyIds: string[]; actorId: string; version: string; config: HrDeliveryConfig[]; attachments: Array<{ companyId: string; sha256: string }> }) {
    return this.database.withTransaction(async client => {
      for (const id of [...input.companyIds].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`incentive-hr:${input.period}:${id}`]);
      // Lock the assignments as well as rechecking the live grant before any delivery claim.
      await client.query("SELECT user_role_assignment_id FROM ops.user_role_assignment WHERE user_id = $1::uuid AND company_id = ANY($2::uuid[]) FOR SHARE", [input.actorId, input.companyIds]);
      const grants = await client.query<{ company_id: string }>(hrGrantSql, [input.actorId, input.companyIds]);
      if (input.companyIds.some(id => !grants.rows.some(row => row.company_id === id))) throw new ForbiddenException("Prim gönderim yetkisi artık geçerli değil.");
      const snapshot = await this.readSnapshot(client, input.period, input.companyIds);
      if (!hrSnapshotReady(snapshot) || hrSnapshotVersion(input.period, snapshot, input.config) !== input.version) throw new ConflictException("Dönem bilgileri değişti. Özeti yeniden açın.");
      if (snapshot.deliveries.some(item => item.status !== "sent")) throw new ConflictException("Bu dönem için gönderim daha önce başlatıldı. Gönderim durumunu kontrol edin.");
      const companies = [...new Set(snapshot.packages.map(item => item.company_id))].filter(id => !snapshot.deliveries.some(item => item.company_id === id));
      if (!companies.length) throw new ConflictException("Bu dönem İK’ya zaten gönderildi.");
      const deliveries: HrDeliveryRow[] = [];
      for (const companyId of companies) {
        const recipients = input.config.find(item => item.companyId === companyId)?.recipients;
        const attachment = input.attachments.find(item => item.companyId === companyId);
        if (!recipients?.length || !attachment) throw new ConflictException("Gönderim ayarları eksik.");
        const inserted = await client.query<HrDeliveryRow>(`INSERT INTO ops.incentive_hr_delivery
          (company_id, period_key, created_by_user_id, preview_version, recipients, attachment_sha256)
          VALUES ($1::uuid, $2, $3::uuid, $4, $5::text[], $6)
          RETURNING company_id::text, delivery_id::text, status, created_at::text, sent_at::text`, [companyId, input.period, input.actorId, input.version, recipients, attachment.sha256]);
        const delivery = inserted.rows[0];
        deliveries.push(delivery);
        await client.query(`INSERT INTO audit.event_log (actor_user_id, event_type, entity_name, entity_id, scope_type, company_id, metadata_json)
          VALUES ($1::uuid, 'incentive_hr.delivery_started', 'ops.incentive_hr_delivery', $2::uuid, 'company', $3::uuid, $4::jsonb)`, [input.actorId, delivery.delivery_id, companyId, JSON.stringify({ period: input.period, attachmentSha256: attachment.sha256 })]);
      }
      return deliveries;
    });
  }

  async finish(deliveryId: string, status: "sent" | "uncertain", messageId: string | null) {
    await this.database.query(`UPDATE ops.incentive_hr_delivery SET status = $2, smtp_message_id = $3,
      sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END, updated_at = NOW()
      WHERE delivery_id = $1::uuid AND status = 'sending'`, [deliveryId, status, messageId]);
  }

  private async readSnapshot(client: Pick<PoolClient, "query">, period: string, companyIds: string[]): Promise<HrSnapshot> {
    // One statement gives packages, adjustments and receipts the same PostgreSQL snapshot.
    const result = await client.query<HrSnapshot>(`SELECT
      (SELECT COALESCE(json_agg(p), '[]'::json) FROM (${hrPackagesSql}) p) AS packages,
      (SELECT COALESCE(json_agg(r), '[]'::json) FROM (${hrRowsSql}) r) AS rows,
      (SELECT COALESCE(json_agg(d), '[]'::json) FROM (SELECT company_id::text, delivery_id::text, status, created_at::text, sent_at::text FROM ops.incentive_hr_delivery WHERE period_key = $1 AND company_id = ANY($2::uuid[]) ORDER BY company_id) d) AS deliveries`, [period, companyIds]);
    return result.rows[0];
  }
}
