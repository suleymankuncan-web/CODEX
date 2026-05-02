import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";

type ConfigRows = {
  storeProfile: unknown;
  personnelProfile: unknown;
  ownershipMatrix: unknown;
  gradingBands: unknown;
};

type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: T[] }>;
};

const publishedConfigKeys = {
  storeProfile: "store_profile",
  personnelProfile: "personnel_profile",
  ownershipMatrix: "ownership_matrix",
  gradingBands: "grading_bands",
} as const;

const draftConfigKeys = {
  storeProfile: "draft_store_profile",
  personnelProfile: "draft_personnel_profile",
  ownershipMatrix: "draft_ownership_matrix",
  gradingBands: "draft_grading_bands",
} as const;

@Injectable()
export class KpiConfigRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getKpiConfigRows() {
    return this.getConfigRowsByKeys(Object.values(publishedConfigKeys));
  }

  async getDraftKpiConfigRows() {
    return this.getConfigRowsByKeys(Object.values(draftConfigKeys));
  }

  async getEditorKpiConfigRows() {
    return this.getConfigRowsByKeys([
      ...Object.values(publishedConfigKeys),
      ...Object.values(draftConfigKeys),
    ]);
  }

  async getLatestPublishedKpiConfigVersion(client?: Queryable) {
    const runner: Queryable = client ?? (this.databaseService as unknown as Queryable);
    const result = await runner.query<{
      kpi_config_version_id: string;
      version_no: number;
      effective_from: string;
      effective_to: string | null;
      published_at: string;
      published_by: string | null;
      config_payload: {
        storeProfile?: unknown;
        personnelProfile?: unknown;
        ownershipMatrix?: unknown;
        gradingBands?: unknown;
      };
    }>(
      `
        SELECT
          kpi_config_version_id,
          version_no,
          effective_from,
          effective_to,
          published_at,
          published_by,
          config_payload
        FROM ops.kpi_config_version
        WHERE lifecycle_state = 'published'
          AND effective_from <= NOW()
          AND (effective_to IS NULL OR effective_to > NOW())
        ORDER BY version_no DESC
        LIMIT 1
      `,
    );

    return result.rows[0] ?? null;
  }

  async getKpiConfigVersionById(kpiConfigVersionId: string, client?: Queryable) {
    const runner: Queryable = client ?? (this.databaseService as unknown as Queryable);
    const result = await runner.query<{
      kpi_config_version_id: string;
      version_no: number;
      effective_from: string;
      effective_to: string | null;
      published_at: string;
      published_by: string | null;
      config_payload: {
        storeProfile?: unknown;
        personnelProfile?: unknown;
        ownershipMatrix?: unknown;
        gradingBands?: unknown;
      };
    }>(
      `
        SELECT
          kpi_config_version_id,
          version_no,
          effective_from,
          effective_to,
          published_at,
          published_by,
          config_payload
        FROM ops.kpi_config_version
        WHERE kpi_config_version_id = $1::uuid
        LIMIT 1
      `,
      [kpiConfigVersionId],
    );

    return result.rows[0] ?? null;
  }

  private async getConfigRowsByKeys(configKeys: string[]) {
    const result = await this.databaseService.query<{
      config_key: string;
      config_payload: unknown;
    }>(
      `
        SELECT
          config_key,
          config_payload
        FROM ops.kpi_score_profile_config
        WHERE config_key = ANY($1::text[])
        ORDER BY config_key ASC
      `,
      [configKeys],
    );

    return result.rows;
  }

  async listKpiConfigAudit(limit = 20) {
    const result = await this.databaseService.query<{
      event_log_id: string;
      occurred_at: string;
      actor_user_id: string | null;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE event_type IN ('kpi_config.updated', 'kpi_config.draft_saved', 'kpi_config.published')
          AND entity_name = 'ops.kpi_score_profile_config'
        ORDER BY occurred_at DESC, event_log_id DESC
        LIMIT $1::int
      `,
      [limit],
    );

    return result.rows;
  }

  async saveKpiConfigDraft(input: {
    actorUserId: string;
    storeProfile: unknown;
    personnelProfile: unknown;
    ownershipMatrix: unknown;
    gradingBands: unknown;
  }) {
    await this.databaseService.withTransaction(async (client) => {
      const existingRows = await client.query<{
        config_key: string;
        config_payload: unknown;
      }>(
        `
          SELECT
            config_key,
            config_payload
          FROM ops.kpi_score_profile_config
          WHERE config_key = ANY($1::text[])
        `,
        [Object.values(draftConfigKeys)],
      );
      const currentConfig = buildConfigRows(existingRows.rows, draftConfigKeys);

      await client.query(
        `
          INSERT INTO ops.kpi_score_profile_config (config_key, config_payload)
          VALUES
            ('draft_store_profile', $1::jsonb),
            ('draft_personnel_profile', $2::jsonb),
            ('draft_ownership_matrix', $3::jsonb),
            ('draft_grading_bands', $4::jsonb)
          ON CONFLICT (config_key) DO UPDATE
          SET
            config_payload = EXCLUDED.config_payload,
            updated_at = NOW()
        `,
        [
          JSON.stringify(input.storeProfile),
          JSON.stringify(input.personnelProfile),
          JSON.stringify(input.ownershipMatrix),
          JSON.stringify(input.gradingBands),
        ],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES (
            (
              SELECT user_id
              FROM ops.user_account
              WHERE user_id = $1::uuid
            ),
            'kpi_config.draft_saved',
            'ops.kpi_score_profile_config',
            NULL,
            'company',
            $2::jsonb
          )
        `,
        [
          input.actorUserId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            storeMetricCount: Array.isArray((input.storeProfile as { metrics?: unknown[] })?.metrics)
              ? (input.storeProfile as { metrics: unknown[] }).metrics.length
              : null,
            personnelMetricCount: Array.isArray(
              (input.personnelProfile as { metrics?: unknown[] })?.metrics,
            )
              ? (input.personnelProfile as { metrics: unknown[] }).metrics.length
              : null,
            ownershipRowCount: Array.isArray(input.ownershipMatrix)
              ? input.ownershipMatrix.length
              : null,
            gradingBandCount: Array.isArray(input.gradingBands)
              ? input.gradingBands.length
              : null,
            diffSummary: {
              storeProfile: summarizeMetricDiff(currentConfig.storeProfile, input.storeProfile),
              personnelProfile: summarizeMetricDiff(
                currentConfig.personnelProfile,
                input.personnelProfile,
              ),
              ownershipMatrix: summarizeOwnershipDiff(
                currentConfig.ownershipMatrix,
                input.ownershipMatrix,
              ),
              gradingBands: summarizeGradingBandDiff(
                currentConfig.gradingBands,
                input.gradingBands,
              ),
            },
          }),
        ],
      );
    });
  }

  async publishKpiConfigDraft(actorUserId: string) {
    return this.databaseService.withTransaction(async (client) => {
      const existingRows = await client.query<{
        config_key: string;
        config_payload: unknown;
      }>(
        `
          SELECT
            config_key,
            config_payload
          FROM ops.kpi_score_profile_config
          WHERE config_key = ANY($1::text[])
        `,
        [[...Object.values(publishedConfigKeys), ...Object.values(draftConfigKeys)]],
      );

      const publishedConfig = buildConfigRows(existingRows.rows, publishedConfigKeys);
      const draftConfig = buildConfigRows(existingRows.rows, draftConfigKeys);
      const diffSummary = {
        storeProfile: summarizeMetricDiff(
          publishedConfig.storeProfile,
          draftConfig.storeProfile,
        ),
        personnelProfile: summarizeMetricDiff(
          publishedConfig.personnelProfile,
          draftConfig.personnelProfile,
        ),
        ownershipMatrix: summarizeOwnershipDiff(
          publishedConfig.ownershipMatrix,
          draftConfig.ownershipMatrix,
        ),
        gradingBands: summarizeGradingBandDiff(
          publishedConfig.gradingBands,
          draftConfig.gradingBands,
        ),
      };

      await client.query(
        `
          INSERT INTO ops.kpi_score_profile_config (config_key, config_payload)
          VALUES
            ('store_profile', $1::jsonb),
            ('personnel_profile', $2::jsonb),
            ('ownership_matrix', $3::jsonb),
            ('grading_bands', $4::jsonb)
          ON CONFLICT (config_key) DO UPDATE
          SET
            config_payload = EXCLUDED.config_payload,
            updated_at = NOW()
        `,
        [
          JSON.stringify(draftConfig.storeProfile),
          JSON.stringify(draftConfig.personnelProfile),
          JSON.stringify(draftConfig.ownershipMatrix),
          JSON.stringify(draftConfig.gradingBands),
        ],
      );

      const versionResult = await client.query<{
        kpi_config_version_id: string;
        version_no: number;
        effective_from: string;
        effective_to: string | null;
        published_at: string;
        published_by: string | null;
      }>(
        `
          INSERT INTO ops.kpi_config_version (
            version_no,
            lifecycle_state,
            effective_from,
            published_at,
            published_by,
            change_summary,
            config_payload
          )
          VALUES (
            COALESCE((SELECT MAX(version_no) + 1 FROM ops.kpi_config_version), 1),
            'published',
            NOW(),
            NOW(),
            $1::uuid,
            $2::jsonb,
            $3::jsonb
          )
          RETURNING
            kpi_config_version_id,
            version_no,
            effective_from,
            effective_to,
            published_at,
            published_by
        `,
        [
          actorUserId,
          JSON.stringify(diffSummary),
          JSON.stringify({
            storeProfile: draftConfig.storeProfile,
            personnelProfile: draftConfig.personnelProfile,
            ownershipMatrix: draftConfig.ownershipMatrix,
            gradingBands: draftConfig.gradingBands,
          }),
        ],
      );
      const version = versionResult.rows[0] ?? null;

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES (
            (
              SELECT user_id
              FROM ops.user_account
              WHERE user_id = $1::uuid
            ),
            'kpi_config.published',
            'ops.kpi_score_profile_config',
            NULL,
            'company',
            $2::jsonb
          )
        `,
        [
          actorUserId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId,
            kpiConfigVersionId: version?.kpi_config_version_id ?? null,
            versionNo: version?.version_no ?? null,
            publishedMetricCount: Array.isArray((draftConfig.storeProfile as { metrics?: unknown[] })?.metrics)
              ? (draftConfig.storeProfile as { metrics: unknown[] }).metrics.length
              : null,
            publishedPersonnelMetricCount: Array.isArray(
              (draftConfig.personnelProfile as { metrics?: unknown[] })?.metrics,
            )
              ? (draftConfig.personnelProfile as { metrics: unknown[] }).metrics.length
              : null,
            publishedOwnershipRowCount: Array.isArray(draftConfig.ownershipMatrix)
              ? draftConfig.ownershipMatrix.length
              : null,
            publishedGradingBandCount: Array.isArray(draftConfig.gradingBands)
              ? draftConfig.gradingBands.length
              : null,
            diffSummary,
          }),
        ],
      );

      return version;
    });
  }
}

function buildConfigRows(
  rows: Array<{
    config_key: string;
    config_payload: unknown;
  }>,
  configKeys: {
    storeProfile: string;
    personnelProfile: string;
    ownershipMatrix: string;
    gradingBands: string;
  },
): ConfigRows {
  const configMap = new Map(rows.map((row) => [row.config_key, row.config_payload]));
  return {
    storeProfile: configMap.get(configKeys.storeProfile) ?? null,
    personnelProfile: configMap.get(configKeys.personnelProfile) ?? null,
    ownershipMatrix: configMap.get(configKeys.ownershipMatrix) ?? null,
    gradingBands: configMap.get(configKeys.gradingBands) ?? null,
  };
}

function summarizeMetricDiff(currentValue: unknown, nextValue: unknown) {
  const currentMetrics = extractMetricRows(currentValue);
  const nextMetrics = extractMetricRows(nextValue);
  const currentMap = new Map(currentMetrics.map((item) => [item.code, normalizeForCompare(item)]));
  const nextMap = new Map(nextMetrics.map((item) => [item.code, normalizeForCompare(item)]));

  return summarizeCodeDiff(currentMap, nextMap);
}

function summarizeOwnershipDiff(currentValue: unknown, nextValue: unknown) {
  const currentRows = extractOwnershipRows(currentValue);
  const nextRows = extractOwnershipRows(nextValue);
  const currentMap = new Map(currentRows.map((item) => [item.code, normalizeForCompare(item)]));
  const nextMap = new Map(nextRows.map((item) => [item.code, normalizeForCompare(item)]));

  return summarizeCodeDiff(currentMap, nextMap);
}

function summarizeGradingBandDiff(currentValue: unknown, nextValue: unknown) {
  const currentRows = extractGradingBandRows(currentValue);
  const nextRows = extractGradingBandRows(nextValue);
  const currentMap = new Map(currentRows.map((item) => [item.code, normalizeForCompare(item)]));
  const nextMap = new Map(nextRows.map((item) => [item.code, normalizeForCompare(item)]));

  return summarizeCodeDiff(currentMap, nextMap);
}

function summarizeCodeDiff(currentMap: Map<string, string>, nextMap: Map<string, string>) {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const code of nextMap.keys()) {
    if (!currentMap.has(code)) {
      added.push(code);
      continue;
    }
    if (currentMap.get(code) !== nextMap.get(code)) {
      changed.push(code);
    }
  }

  for (const code of currentMap.keys()) {
    if (!nextMap.has(code)) {
      removed.push(code);
    }
  }

  return { added, removed, changed };
}

function extractMetricRows(input: unknown) {
  if (!input || typeof input !== "object") {
    return [];
  }

  const metrics = (input as { metrics?: unknown[] }).metrics;
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics.filter(
    (item): item is Record<string, unknown> & { code: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { code?: unknown }).code === "string",
  );
}

function extractOwnershipRows(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(
    (item): item is Record<string, unknown> & { code: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { code?: unknown }).code === "string",
  );
}

function extractGradingBandRows(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(
    (item): item is Record<string, unknown> & { code: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { code?: unknown }).code === "string",
  );
}

function normalizeForCompare(input: Record<string, unknown>) {
  return JSON.stringify(input, Object.keys(input).sort());
}
