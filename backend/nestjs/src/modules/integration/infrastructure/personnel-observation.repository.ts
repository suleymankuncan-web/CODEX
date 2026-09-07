import { BadRequestException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";

export type PersonnelObservationReplacement = {
  sourceId: string;
  businessDate: string;
  generation: string;
  digest: string;
  observations: Array<{ storeCode: string; personnelCode: string }>;
};
export type PersonnelObservationListInput = {
  actorCompanyIds: string[];
  fromDate: string;
  toDate: string;
  storeId?: string;
  q?: string;
  limit: number;
  offset: number;
};
export type PersonnelObservationRow = {
  source_id: string;
  business_date: string;
  store_id: string;
  store_code: string;
  store_name: string;
  personnel_code: string;
};

@Injectable()
export class PersonnelObservationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async beginAttempt(sourceId: string, businessDate: string): Promise<string> {
    validateIdentity(sourceId, businessDate);
    return this.databaseService.withTransaction(async (client) => {
      await this.lockSource(client, sourceId, businessDate);
      const result = await client.query<{ generation: string }>(`
        INSERT INTO ops.personnel_observation_attempt (source_id, business_date, generation)
        VALUES ($1::uuid, $2::date, 1)
        ON CONFLICT (source_id, business_date) DO UPDATE
        SET generation = ops.personnel_observation_attempt.generation + 1
        RETURNING generation::text
      `, [sourceId, businessDate]);
      return result.rows[0].generation;
    });
  }

  async replace(input: PersonnelObservationReplacement) {
    validateReplacement(input);
    const pairs = [...new Map(input.observations.map((row) =>
      [JSON.stringify([row.storeCode, row.personnelCode]), { ...row }],
    )).values()];
    return this.databaseService.withTransaction(async (client) => {
      await this.lockSource(client, input.sourceId, input.businessDate);
      const attempt = await client.query<{
        generation: string; accepted_generation: string; accepted_digest: string | null;
      }>(`SELECT generation::text, accepted_generation::text, accepted_digest
          FROM ops.personnel_observation_attempt
          WHERE source_id = $1::uuid AND business_date = $2::date FOR UPDATE`,
      [input.sourceId, input.businessDate]);
      const current = attempt.rows[0];
      if (!current || current.generation !== input.generation) fail();
      if (current.accepted_generation === input.generation && current.accepted_digest !== input.digest) fail();
      if (current.accepted_generation === input.generation) {
        const persisted = await client.query<{ count: string }>(`SELECT count(*)::text AS count
          FROM ops.personnel_observation WHERE source_id = $1::uuid AND business_date = $2::date`,
        [input.sourceId, input.businessDate]);
        const acceptedCount = Number(persisted.rows[0].count);
        return { acceptedCount, excludedCount: pairs.length - acceptedCount, unchanged: true };
      }
      const stores = await client.query<{ store_id: string; store_code: string }>(`
        SELECT store_id, store_code FROM ops.store
        WHERE store_code = ANY($1::text[]) AND status = 'active'
          AND kpi_import_enabled = TRUE FOR SHARE
      `, [[...new Set(pairs.map((row) => row.storeCode))]]);
      const mapping = new Map(stores.rows.map((row) => [row.store_code, row.store_id]));
      // Exact code mappings must be unambiguous, even if a schema later relaxes uniqueness.
      if (mapping.size !== stores.rows.length) fail();
      const accepted = pairs.filter((row) => mapping.has(row.storeCode)).map((row) => ({
        store_id: mapping.get(row.storeCode)!, personnel_code: row.personnelCode,
      }));
      const result = { acceptedCount: accepted.length, excludedCount: pairs.length - accepted.length, unchanged: false };
      await client.query(`DELETE FROM ops.personnel_observation
        WHERE source_id = $1::uuid AND business_date = $2::date`, [input.sourceId, input.businessDate]);
      for (let start = 0; start < accepted.length; start += 1000) {
        await client.query(`INSERT INTO ops.personnel_observation
          (source_id, business_date, store_id, personnel_code)
          SELECT $1::uuid, $2::date, row.store_id, row.personnel_code
          FROM jsonb_to_recordset($3::jsonb) AS row(store_id uuid, personnel_code text)`,
        [input.sourceId, input.businessDate, JSON.stringify(accepted.slice(start, start + 1000))]);
      }
      await client.query(`UPDATE ops.personnel_observation_attempt
        SET accepted_generation = $3::bigint, accepted_digest = $4
        WHERE source_id = $1::uuid AND business_date = $2::date`,
      [input.sourceId, input.businessDate, input.generation, input.digest]);
      return result;
    });
  }

  async list(input: PersonnelObservationListInput): Promise<{ rows: PersonnelObservationRow[]; total: number }> {
    if (!Array.isArray(input.actorCompanyIds) || input.actorCompanyIds.length === 0 ||
      !input.actorCompanyIds.every(uuid) || !date(input.fromDate) || !date(input.toDate) ||
      input.fromDate > input.toDate || (input.storeId !== undefined && !uuid(input.storeId)) ||
      (input.q !== undefined && (typeof input.q !== "string" || input.q.length > 80)) ||
      !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 1000 ||
      !Number.isSafeInteger(input.offset) || input.offset < 0) fail();
    // A single statement retains the total even when the requested page is empty.
    const result = await this.databaseService.query<{ rows: PersonnelObservationRow[]; total: string }>(`
      WITH scoped AS MATERIALIZED (
        SELECT o.source_id, o.business_date::text AS business_date, o.store_id,
          s.store_code, s.store_name, o.personnel_code
        FROM ops.personnel_observation o JOIN ops.store s ON s.store_id = o.store_id
        WHERE s.company_id = ANY($1::uuid[]) AND o.business_date BETWEEN $2::date AND $3::date
          AND ($4::uuid IS NULL OR o.store_id = $4::uuid)
          AND ($5::text IS NULL OR strpos(lower(o.personnel_code), lower($5)) > 0
            OR strpos(lower(s.store_code), lower($5)) > 0 OR strpos(lower(s.store_name), lower($5)) > 0)
      ), page AS (
        SELECT * FROM scoped ORDER BY business_date DESC, personnel_code, store_code, source_id, store_id
        LIMIT $6 OFFSET $7
      )
      SELECT COALESCE((SELECT jsonb_agg(page ORDER BY business_date DESC, personnel_code,
        store_code, source_id, store_id) FROM page), '[]'::jsonb) AS rows,
        (SELECT count(*)::text FROM scoped) AS total
    `, [input.actorCompanyIds, input.fromDate, input.toDate, input.storeId ?? null,
      input.q ?? null, input.limit, input.offset]);
    return { rows: result.rows[0].rows, total: Number(result.rows[0].total) };
  }

  private async lockSource(client: PoolClient, sourceId: string, businessDate: string) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
      [`company-daily-kpi:${sourceId}:${businessDate}:sales`]);
    const source = await client.query(`SELECT integration_source_id FROM stg.integration_source
      WHERE integration_source_id = $1::uuid AND is_active = TRUE FOR SHARE`, [sourceId]);
    if (source.rows.length !== 1) fail();
  }
}

function fail(): never { throw new BadRequestException("personnel_observation_invalid"); }
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function code(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80 &&
    value.trim() === value && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
}
function validateIdentity(sourceId: string, businessDate: string) {
  if (!uuid(sourceId) || !date(businessDate)) fail();
}
function validateReplacement(input: PersonnelObservationReplacement) {
  if (!input || typeof input !== "object" || Object.keys(input).sort().join() !==
    "businessDate,digest,generation,observations,sourceId") fail();
  validateIdentity(input.sourceId, input.businessDate);
  if (typeof input.generation !== "string" || !/^[1-9]\d{0,18}$/.test(input.generation) ||
    BigInt(input.generation) > 9223372036854775807n || typeof input.digest !== "string" ||
    !/^[0-9a-f]{64}$/.test(input.digest) || !Array.isArray(input.observations) || input.observations.length > 100000) fail();
  for (const row of input.observations) {
    if (!row || typeof row !== "object" || Object.keys(row).sort().join() !== "personnelCode,storeCode" ||
      !code(row.storeCode) || !code(row.personnelCode)) fail();
  }
}
