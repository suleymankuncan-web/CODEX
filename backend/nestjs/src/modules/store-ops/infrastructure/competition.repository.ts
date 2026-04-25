import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import {
  Competition,
  CompetitionBaseDetail,
  CompetitionStage,
  CompetitionStageFinalizationState,
  CompetitionStoreContribution,
  CompetitionTeam,
  CompetitionTeamScore,
  CompetitionWarning,
  CreateCompetitionStageInput,
  RecalculateCompetitionStageInput,
} from "../application/competition.contract";

type Queryable = Pick<PoolClient, "query">;

type CompetitionRow = {
  competition_id: string;
  competition_code: string;
  competition_name: string;
  description: string | null;
  competition_type: "region_challenge" | "region_league" | "campaign";
  lifecycle_state: Competition["lifecycleState"];
  starts_on: string | Date;
  ends_on: string | Date;
};

type CompetitionStageRow = {
  competition_stage_id: string;
  competition_id: string;
  stage_code: string;
  stage_name: string;
  stage_order: number;
  stage_type: CompetitionStage["stageType"];
  starts_on: string | Date;
  ends_on: string | Date;
  lifecycle_state: CompetitionStage["lifecycleState"];
  finalization_state: CompetitionStageFinalizationState | null;
};

type CompetitionTeamStoreRow = {
  competition_team_id: string;
  team_code: string;
  team_name: string;
  team_order: number;
  store_id: string | null;
  store_code: string | null;
  store_name: string | null;
  region_id: string | null;
};

type CompetitionTeamScoreRow = {
  stage_id: string;
  team_id: string;
  team_code: string;
  team_name: string;
  snapshot_date: string | Date;
  score_value: string | number | null;
  valid_store_count: string | number;
  total_store_count: string | number;
  coverage_rate: string | number;
  rank_position: string | number | null;
  ranking_population: string | number;
};

type CompetitionWarningRow = {
  competition_stage_warning_id: string;
  competition_stage_id: string;
  competition_team_id: string | null;
  store_id: string | null;
  warning_code: CompetitionWarning["warningCode"];
  warning_level: CompetitionWarning["warningLevel"];
  period_start: string | Date;
  period_end: string | Date;
  message: string;
  resolved_at: string | Date | null;
};

type CompetitionStoreContributionRow = {
  stage_id: string;
  team_id: string;
  team_code: string;
  team_name: string;
  store_id: string;
  store_code: string;
  store_name: string;
  region_id: string;
  snapshot_date: string | Date;
  score_value: string | number | null;
  reported_weight_percent: string | number;
  expected_weight_percent: string | number;
  has_daily_data: boolean;
  missing_kpi_codes: string[];
};

@Injectable()
export class CompetitionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listCompetitions(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit: number;
    offset: number;
  }): Promise<Competition[]> {
    const result = await this.databaseService.query<CompetitionRow>(
      `
        SELECT DISTINCT
          competition.competition_id,
          competition.competition_code,
          competition.competition_name,
          competition.description,
          competition.competition_type,
          competition.lifecycle_state,
          competition.starts_on,
          competition.ends_on
        FROM ops.competition competition
        LEFT JOIN ops.competition_stage stage
          ON stage.competition_id = competition.competition_id
        LEFT JOIN ops.competition_team team
          ON team.competition_stage_id = stage.competition_stage_id
        LEFT JOIN ops.competition_team_store team_store
          ON team_store.competition_team_id = team.competition_team_id
        LEFT JOIN ops.store store
          ON store.store_id = team_store.store_id
        WHERE
          cardinality($1::uuid[]) > 0
          OR store.region_id = ANY($2::uuid[])
          OR store.store_id = ANY($3::uuid[])
          OR team_store.store_id IS NULL
        ORDER BY competition.starts_on DESC, competition.competition_code ASC
        LIMIT $4::int
        OFFSET $5::int
      `,
      [input.companyIds, input.regionIds, input.storeIds, input.limit, input.offset],
    );

    return result.rows.map(mapCompetition);
  }

  async getCompetitionDetail(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }): Promise<CompetitionBaseDetail | null> {
    const competitionResult = await this.databaseService.query<CompetitionRow>(
      `
        SELECT DISTINCT
          competition.competition_id,
          competition.competition_code,
          competition.competition_name,
          competition.description,
          competition.competition_type,
          competition.lifecycle_state,
          competition.starts_on,
          competition.ends_on
        FROM ops.competition competition
        LEFT JOIN ops.competition_stage stage
          ON stage.competition_id = competition.competition_id
        LEFT JOIN ops.competition_team team
          ON team.competition_stage_id = stage.competition_stage_id
        LEFT JOIN ops.competition_team_store team_store
          ON team_store.competition_team_id = team.competition_team_id
        LEFT JOIN ops.store store
          ON store.store_id = team_store.store_id
        WHERE competition.competition_id = $1::uuid
          AND (
            cardinality($2::uuid[]) > 0
            OR store.region_id = ANY($3::uuid[])
            OR store.store_id = ANY($4::uuid[])
            OR team_store.store_id IS NULL
          )
      `,
      [input.competitionId, input.companyIds, input.regionIds, input.storeIds],
    );

    const competition = competitionResult.rows[0];
    if (!competition) {
      return null;
    }

    const stages = await this.listStages(input.competitionId);
    const teams = await this.listTeams(input.competitionId);
    const latestScores = await this.listLatestScores(input.competitionId);
    const warnings = await this.listWarningsForCompetition(input);

    return {
      competition: mapCompetition(competition),
      stages,
      teams,
      latestScores,
      warnings,
    };
  }

  async listStoreContributionsForCompetition(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }): Promise<CompetitionStoreContribution[]> {
    const result = await this.databaseService.query<CompetitionStoreContributionRow>(
      `
        SELECT
          store_score.competition_stage_id AS stage_id,
          store_score.competition_team_id AS team_id,
          team.team_code,
          team.team_name,
          store.store_id,
          store.store_code,
          store.store_name,
          store.region_id,
          store_score.snapshot_date,
          store_score.score_value,
          store_score.reported_weight_percent,
          store_score.expected_weight_percent,
          store_score.has_daily_data,
          store_score.missing_kpi_codes
        FROM rpt.competition_stage_store_score_snapshot store_score
        INNER JOIN ops.competition_stage stage
          ON stage.competition_stage_id = store_score.competition_stage_id
        INNER JOIN ops.competition_team team
          ON team.competition_team_id = store_score.competition_team_id
        INNER JOIN ops.store store
          ON store.store_id = store_score.store_id
        WHERE stage.competition_id = $1::uuid
          AND (
            cardinality($2::uuid[]) > 0
            OR store.region_id = ANY($3::uuid[])
            OR store.store_id = ANY($4::uuid[])
          )
        ORDER BY
          stage.stage_order ASC,
          store_score.snapshot_date DESC,
          team.team_order ASC,
          store.store_code ASC
      `,
      [input.competitionId, input.companyIds, input.regionIds, input.storeIds],
    );

    return result.rows.map(mapStoreContribution);
  }

  async createCompetition(input: {
    actorUserId: string;
    ownerUserId: string;
    competitionCode: string;
    competitionName: string;
    description?: string;
    competitionType: "region_challenge" | "region_league" | "campaign";
    startsOn: string;
    endsOn: string;
  }): Promise<Competition> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionRow>(
        `
          INSERT INTO ops.competition (
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            owner_user_id,
            starts_on,
            ends_on
          )
          VALUES ($1, $2, $3, $4, 'draft', $5, $6::date, $7::date)
          RETURNING
            competition_id,
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            starts_on,
            ends_on
        `,
        [
          input.competitionCode,
          input.competitionName,
          input.description ?? null,
          input.competitionType,
          input.ownerUserId,
          input.startsOn,
          input.endsOn,
        ],
      );

      const row = result.rows[0];
      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition.created",
        entityName: "ops.competition",
        entityId: row.competition_id,
        metadata: {
          competitionCode: input.competitionCode,
          competitionType: input.competitionType,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        },
      });

      return mapCompetition(row);
    });
  }

  async createStageWithTeams(input: CreateCompetitionStageInput): Promise<CompetitionStage> {
    return this.databaseService.withTransaction(async (client) => {
      const stageResult = await client.query<CompetitionStageRow>(
        `
          INSERT INTO ops.competition_stage (
            competition_id,
            stage_code,
            stage_name,
            stage_order,
            stage_type,
            starts_on,
            ends_on,
            lifecycle_state,
            advancement_rule_json
          )
          VALUES ($1::uuid, $2, $3, $4::int, $5, $6::date, $7::date, 'active', $8::jsonb)
          RETURNING
            competition_stage_id,
            competition_id,
            stage_code,
            stage_name,
            stage_order,
            stage_type,
            starts_on,
            ends_on,
            lifecycle_state,
            finalization_state
        `,
        [
          input.competitionId,
          input.stageCode,
          input.stageName,
          input.stageOrder,
          input.stageType,
          input.startsOn,
          input.endsOn,
          JSON.stringify({ type: "top_n", count: 1 }),
        ],
      );

      const stage = stageResult.rows[0];

      for (let index = 0; index < input.teams.length; index += 1) {
        const team = input.teams[index];
        const teamResult = await client.query<{ competition_team_id: string }>(
          `
            INSERT INTO ops.competition_team (
              competition_stage_id,
              source_template_id,
              team_code,
              team_name,
              team_order
            )
            VALUES ($1::uuid, $2::uuid, $3, $4, $5::int)
            RETURNING competition_team_id
          `,
          [
            stage.competition_stage_id,
            team.sourceTemplateId ?? null,
            team.teamCode,
            team.teamName,
            index + 1,
          ],
        );

        await client.query(
          `
            INSERT INTO ops.competition_team_store (
              competition_team_id,
              store_id,
              added_manually
            )
            SELECT $1::uuid, unnest($2::uuid[]), TRUE
            ON CONFLICT DO NOTHING
          `,
          [teamResult.rows[0].competition_team_id, team.storeIds],
        );
      }

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage.created",
        entityName: "ops.competition_stage",
        entityId: stage.competition_stage_id,
        metadata: {
          competitionId: input.competitionId,
          stageCode: input.stageCode,
          teamCount: input.teams.length,
          storeCount: input.teams.reduce((sum, team) => sum + team.storeIds.length, 0),
        },
      });

      return mapStage(stage);
    });
  }

  async recalculateStage(input: RecalculateCompetitionStageInput) {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          DELETE FROM rpt.competition_stage_warning
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );
      await client.query(
        `
          DELETE FROM rpt.competition_stage_score_snapshot
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );
      await client.query(
        `
          DELETE FROM rpt.competition_stage_store_score_snapshot
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );

      const storeSnapshotResult = await client.query(
        `
          WITH stage_scope AS (
              SELECT
                  stage.competition_stage_id,
                  stage.starts_on,
                  stage.ends_on
              FROM ops.competition_stage stage
              WHERE stage.competition_stage_id = $1::uuid
          ),
          closed_days AS (
              SELECT
                  run.snapshot_run_id,
                  run.period_start AS snapshot_date
              FROM rpt.snapshot_run run
              INNER JOIN stage_scope stage
                  ON run.period_start BETWEEN stage.starts_on AND stage.ends_on
              WHERE run.snapshot_type = 'daily'
                AND run.run_status = 'completed'
                AND run.period_start = run.period_end
          ),
          team_stores AS (
              SELECT
                  team.competition_team_id,
                  team_store.store_id
              FROM ops.competition_team team
              INNER JOIN ops.competition_team_store team_store
                  ON team_store.competition_team_id = team.competition_team_id
              WHERE team.competition_stage_id = $1::uuid
          ),
          metric_weights AS (
              SELECT *
              FROM (VALUES
                  ('TARGET_ACHIEVEMENT', 40::numeric),
                  ('CR', 20::numeric),
                  ('ATV', 15::numeric),
                  ('UPT', 15::numeric),
                  ('BM_CHECKLIST', 5::numeric),
                  ('VM_CHECKLIST', 5::numeric)
              ) AS weights(kpi_code, weight_percent)
          ),
          store_day_matrix AS (
              SELECT
                  team_stores.competition_team_id,
                  team_stores.store_id,
                  closed_days.snapshot_run_id,
                  closed_days.snapshot_date
              FROM team_stores
              CROSS JOIN closed_days
          ),
          metric_values AS (
              SELECT
                  matrix.competition_team_id,
                  matrix.store_id,
                  matrix.snapshot_date,
                  weights.kpi_code,
                  weights.weight_percent,
                  snapshot.actual_value,
                  snapshot.achievement_rate
              FROM store_day_matrix matrix
              CROSS JOIN metric_weights weights
              LEFT JOIN ops.kpi_definition definition
                  ON definition.kpi_code = weights.kpi_code
              LEFT JOIN rpt.store_kpi_snapshot snapshot
                  ON snapshot.store_id = matrix.store_id
                 AND snapshot.kpi_id = definition.kpi_id
                 AND (
                      (weights.kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
                       AND snapshot.snapshot_run_id = matrix.snapshot_run_id
                       AND snapshot.period_start = matrix.snapshot_date
                       AND snapshot.period_end = matrix.snapshot_date)
                      OR
                      (weights.kpi_code IN ('BM_CHECKLIST', 'VM_CHECKLIST')
                       AND snapshot.period_start <= matrix.snapshot_date
                       AND snapshot.period_end >= matrix.snapshot_date)
                 )
          ),
          store_scores AS (
              SELECT
                  competition_team_id,
                  store_id,
                  snapshot_date,
                  SUM(
                      CASE
                          WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0
                          WHEN achievement_rate IS NOT NULL THEN achievement_rate * 100 * weight_percent / 100
                          ELSE actual_value * weight_percent / 100
                      END
                  ) AS score_value,
                  SUM(CASE WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0 ELSE weight_percent END) AS reported_weight_percent,
                  ARRAY_AGG(kpi_code ORDER BY kpi_code) FILTER (
                      WHERE actual_value IS NULL AND achievement_rate IS NULL
                  ) AS missing_kpi_codes,
                  COUNT(*) FILTER (
                      WHERE kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
                        AND (actual_value IS NOT NULL OR achievement_rate IS NOT NULL)
                  ) > 0 AS has_daily_data
              FROM metric_values
              GROUP BY competition_team_id, store_id, snapshot_date
          )
          INSERT INTO rpt.competition_stage_store_score_snapshot (
              competition_stage_id,
              competition_team_id,
              store_id,
              snapshot_date,
              score_value,
              reported_weight_percent,
              expected_weight_percent,
              has_daily_data,
              missing_kpi_codes
          )
          SELECT
              $1::uuid,
              competition_team_id,
              store_id,
              snapshot_date,
              CASE WHEN has_daily_data THEN score_value ELSE NULL END,
              reported_weight_percent,
              100,
              has_daily_data,
              COALESCE(missing_kpi_codes, ARRAY[]::text[])
          FROM store_scores
        `,
        [input.stageId],
      );

      const warningResult = await client.query(
        `
          INSERT INTO rpt.competition_stage_warning (
              competition_stage_id,
              competition_team_id,
              store_id,
              warning_code,
              warning_level,
              period_start,
              period_end,
              message
          )
          SELECT
              store_score.competition_stage_id,
              store_score.competition_team_id,
              store_score.store_id,
              warning.warning_code,
              CASE WHEN warning.warning_code = 'missing_daily_store_data' THEN 'blocker' ELSE 'warning' END,
              store_score.snapshot_date,
              store_score.snapshot_date,
              warning.warning_code || ' for store ' || store.store_code || ' on ' || store_score.snapshot_date::text
          FROM rpt.competition_stage_store_score_snapshot store_score
          INNER JOIN ops.store store
              ON store.store_id = store_score.store_id
          CROSS JOIN LATERAL unnest(
              ARRAY[
                  CASE WHEN store_score.has_daily_data = FALSE THEN 'missing_daily_store_data' END,
                  CASE WHEN 'BM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_bm_checklist' END,
                  CASE WHEN 'VM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_vm_checklist' END
              ]::text[]
          ) AS warning(warning_code)
          WHERE store_score.competition_stage_id = $1::uuid
            AND warning.warning_code IS NOT NULL
        `,
        [input.stageId],
      );

      const teamSnapshotResult = await client.query(
        `
          WITH team_scores AS (
              SELECT
                  competition_stage_id,
                  competition_team_id,
                  snapshot_date,
                  AVG(score_value) FILTER (WHERE score_value IS NOT NULL) AS score_value,
                  COUNT(*) FILTER (WHERE score_value IS NOT NULL) AS valid_store_count,
                  COUNT(*) AS total_store_count
              FROM rpt.competition_stage_store_score_snapshot
              WHERE competition_stage_id = $1::uuid
              GROUP BY competition_stage_id, competition_team_id, snapshot_date
          ),
          ranked AS (
              SELECT
                  *,
                  CASE
                      WHEN score_value IS NULL THEN NULL
                      ELSE DENSE_RANK() OVER (PARTITION BY competition_stage_id, snapshot_date ORDER BY score_value DESC)
                  END AS rank_position,
                  COUNT(*) OVER (PARTITION BY competition_stage_id, snapshot_date) AS ranking_population
              FROM team_scores
          )
          INSERT INTO rpt.competition_stage_score_snapshot (
              competition_stage_id,
              competition_team_id,
              snapshot_date,
              score_value,
              valid_store_count,
              total_store_count,
              coverage_rate,
              rank_position,
              ranking_population
          )
          SELECT
              competition_stage_id,
              competition_team_id,
              snapshot_date,
              score_value,
              valid_store_count,
              total_store_count,
              CASE WHEN total_store_count = 0 THEN 0 ELSE valid_store_count::numeric / total_store_count::numeric END,
              rank_position,
              ranking_population
          FROM ranked
        `,
        [input.stageId],
      );

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage.recalculated",
        entityName: "ops.competition_stage",
        entityId: input.stageId,
        metadata: {
          storeSnapshotRows: storeSnapshotResult.rowCount ?? 0,
          warningRows: warningResult.rowCount ?? 0,
          teamSnapshotRows: teamSnapshotResult.rowCount ?? 0,
        },
      });

      return {
        stageId: input.stageId,
        storeSnapshotRows: storeSnapshotResult.rowCount ?? 0,
        warningRows: warningResult.rowCount ?? 0,
        teamSnapshotRows: teamSnapshotResult.rowCount ?? 0,
      };
    });
  }

  async listOpenWarnings(stageId: string): Promise<CompetitionWarning[]> {
    const result = await this.databaseService.query<CompetitionWarningRow>(
      `
        SELECT
          competition_stage_warning_id,
          competition_stage_id,
          competition_team_id,
          store_id,
          warning_code,
          warning_level,
          period_start,
          period_end,
          message,
          resolved_at
        FROM rpt.competition_stage_warning
        WHERE competition_stage_id = $1::uuid
          AND resolved_at IS NULL
        ORDER BY warning_level DESC, warning_code ASC, period_start ASC
      `,
      [stageId],
    );

    return result.rows.map(mapWarning);
  }

  async finalizeStage(input: {
    stageId: string;
    actorUserId: string;
    finalizationState: CompetitionStageFinalizationState;
    finalizationNote: string | null;
    unresolvedWarningCount: number;
  }): Promise<CompetitionStage> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionStageRow>(
        `
          UPDATE ops.competition_stage
          SET
            lifecycle_state = 'finalized',
            finalized_by_user_id = $2,
            finalized_at = NOW(),
            finalization_state = $3,
            finalization_note = $4,
            updated_at = NOW()
          WHERE competition_stage_id = $1::uuid
          RETURNING
            competition_stage_id,
            competition_id,
            stage_code,
            stage_name,
            stage_order,
            stage_type,
            starts_on,
            ends_on,
            lifecycle_state,
            finalization_state
        `,
        [
          input.stageId,
          input.actorUserId,
          input.finalizationState,
          input.finalizationNote,
        ],
      );

      const stage = result.rows[0];
      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage.finalized",
        entityName: "ops.competition_stage",
        entityId: input.stageId,
        metadata: {
          finalizationState: input.finalizationState,
          finalizationNote: input.finalizationNote,
          unresolvedWarningCount: input.unresolvedWarningCount,
        },
      });

      return mapStage(stage);
    });
  }

  private async listStages(competitionId: string): Promise<CompetitionStage[]> {
    const result = await this.databaseService.query<CompetitionStageRow>(
      `
        SELECT
          competition_stage_id,
          competition_id,
          stage_code,
          stage_name,
          stage_order,
          stage_type,
          starts_on,
          ends_on,
          lifecycle_state,
          finalization_state
        FROM ops.competition_stage
        WHERE competition_id = $1::uuid
        ORDER BY stage_order ASC, stage_code ASC
      `,
      [competitionId],
    );

    return result.rows.map(mapStage);
  }

  private async listTeams(competitionId: string): Promise<CompetitionTeam[]> {
    const result = await this.databaseService.query<CompetitionTeamStoreRow>(
      `
        SELECT
          team.competition_team_id,
          team.team_code,
          team.team_name,
          team.team_order,
          store.store_id,
          store.store_code,
          store.store_name,
          store.region_id
        FROM ops.competition_stage stage
        INNER JOIN ops.competition_team team
          ON team.competition_stage_id = stage.competition_stage_id
        LEFT JOIN ops.competition_team_store team_store
          ON team_store.competition_team_id = team.competition_team_id
        LEFT JOIN ops.store store
          ON store.store_id = team_store.store_id
        WHERE stage.competition_id = $1::uuid
        ORDER BY stage.stage_order ASC, team.team_order ASC, store.store_code ASC
      `,
      [competitionId],
    );

    return mapTeams(result.rows);
  }

  private async listLatestScores(competitionId: string): Promise<CompetitionTeamScore[]> {
    const result = await this.databaseService.query<CompetitionTeamScoreRow>(
      `
        WITH latest_dates AS (
          SELECT
            score.competition_stage_id,
            MAX(score.snapshot_date) AS snapshot_date
          FROM rpt.competition_stage_score_snapshot score
          INNER JOIN ops.competition_stage stage
            ON stage.competition_stage_id = score.competition_stage_id
          WHERE stage.competition_id = $1::uuid
          GROUP BY score.competition_stage_id
        )
        SELECT
          score.competition_stage_id AS stage_id,
          score.competition_team_id AS team_id,
          team.team_code,
          team.team_name,
          score.snapshot_date,
          score.score_value,
          score.valid_store_count,
          score.total_store_count,
          score.coverage_rate,
          score.rank_position,
          score.ranking_population
        FROM rpt.competition_stage_score_snapshot score
        INNER JOIN latest_dates latest
          ON latest.competition_stage_id = score.competition_stage_id
         AND latest.snapshot_date = score.snapshot_date
        INNER JOIN ops.competition_team team
          ON team.competition_team_id = score.competition_team_id
        ORDER BY score.rank_position ASC NULLS LAST, team.team_order ASC
      `,
      [competitionId],
    );

    return result.rows.map(mapScore);
  }

  private async listWarningsForCompetition(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }): Promise<CompetitionWarning[]> {
    const result = await this.databaseService.query<CompetitionWarningRow>(
      `
        SELECT
          warning.competition_stage_warning_id,
          warning.competition_stage_id,
          warning.competition_team_id,
          warning.store_id,
          warning.warning_code,
          warning.warning_level,
          warning.period_start,
          warning.period_end,
          warning.message,
          warning.resolved_at
        FROM rpt.competition_stage_warning warning
        INNER JOIN ops.competition_stage stage
          ON stage.competition_stage_id = warning.competition_stage_id
        LEFT JOIN ops.store store
          ON store.store_id = warning.store_id
        WHERE stage.competition_id = $1::uuid
          AND (
            cardinality($2::uuid[]) > 0
            OR store.region_id = ANY($3::uuid[])
            OR store.store_id = ANY($4::uuid[])
            OR warning.store_id IS NULL
          )
        ORDER BY warning.warning_level DESC, warning.period_start ASC, warning.warning_code ASC
      `,
      [input.competitionId, input.companyIds, input.regionIds, input.storeIds],
    );

    return result.rows.map(mapWarning);
  }
}

async function writeCompetitionAudit(
  client: Queryable,
  input: {
    actorUserId: string;
    eventType: string;
    entityName: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) {
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
        NULL,
        $1,
        $2,
        $3::uuid,
        'company',
        $4::jsonb
      )
    `,
    [
      input.eventType,
      input.entityName,
      input.entityId,
      JSON.stringify({
        correlationId: RequestContextStore.getCorrelationId(),
        actorUserId: input.actorUserId,
        ...input.metadata,
      }),
    ],
  );
}

function mapCompetition(row: CompetitionRow): Competition {
  return {
    competitionId: row.competition_id,
    competitionCode: row.competition_code,
    competitionName: row.competition_name,
    description: row.description,
    competitionType: row.competition_type,
    lifecycleState: row.lifecycle_state,
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
  };
}

function mapStage(row: CompetitionStageRow): CompetitionStage {
  return {
    competitionStageId: row.competition_stage_id,
    competitionId: row.competition_id,
    stageCode: row.stage_code,
    stageName: row.stage_name,
    stageOrder: Number(row.stage_order),
    stageType: row.stage_type,
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    lifecycleState: row.lifecycle_state,
    finalizationState: row.finalization_state,
  };
}

function mapTeams(rows: CompetitionTeamStoreRow[]): CompetitionTeam[] {
  const teams = new Map<string, CompetitionTeam>();

  for (const row of rows) {
    const team =
      teams.get(row.competition_team_id) ??
      {
        competitionTeamId: row.competition_team_id,
        teamCode: row.team_code,
        teamName: row.team_name,
        teamOrder: Number(row.team_order),
        stores: [],
      };

    if (row.store_id && row.store_code && row.store_name && row.region_id) {
      team.stores.push({
        storeId: row.store_id,
        storeCode: row.store_code,
        storeName: row.store_name,
        regionId: row.region_id,
      });
    }

    teams.set(row.competition_team_id, team);
  }

  return [...teams.values()];
}

function mapScore(row: CompetitionTeamScoreRow): CompetitionTeamScore {
  return {
    stageId: row.stage_id,
    teamId: row.team_id,
    teamCode: row.team_code,
    teamName: row.team_name,
    snapshotDate: toDateString(row.snapshot_date),
    scoreValue: row.score_value === null ? null : Number(row.score_value),
    validStoreCount: Number(row.valid_store_count),
    totalStoreCount: Number(row.total_store_count),
    coverageRate: Number(row.coverage_rate),
    rankPosition: row.rank_position === null ? null : Number(row.rank_position),
    rankingPopulation: Number(row.ranking_population),
  };
}

function mapWarning(row: CompetitionWarningRow): CompetitionWarning {
  return {
    warningId: row.competition_stage_warning_id,
    stageId: row.competition_stage_id,
    teamId: row.competition_team_id,
    storeId: row.store_id,
    warningCode: row.warning_code,
    warningLevel: row.warning_level,
    periodStart: toDateString(row.period_start),
    periodEnd: toDateString(row.period_end),
    message: row.message,
    resolvedAt: row.resolved_at ? toDateTimeString(row.resolved_at) : null,
  };
}

function mapStoreContribution(
  row: CompetitionStoreContributionRow,
): CompetitionStoreContribution {
  return {
    stageId: row.stage_id,
    teamId: row.team_id,
    teamCode: row.team_code,
    teamName: row.team_name,
    storeId: row.store_id,
    storeCode: row.store_code,
    storeName: row.store_name,
    regionId: row.region_id,
    snapshotDate: toDateString(row.snapshot_date),
    scoreValue: row.score_value === null ? null : Number(row.score_value),
    reportedWeightPercent: Number(row.reported_weight_percent),
    expectedWeightPercent: Number(row.expected_weight_percent),
    hasDailyData: row.has_daily_data,
    missingKpiCodes: row.missing_kpi_codes,
  };
}

function toDateString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toDateTimeString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
