import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  Competition,
  CompetitionBaseDetail,
  CompetitionStage,
  CompetitionStoreContribution,
  CompetitionTeam,
  CompetitionTeamScore,
  CompetitionWarning,
} from "../application/competition.contract";
import {
  mapCompetition,
  mapScore,
  mapStage,
  mapStoreContribution,
  mapTeams,
  mapWarning,
  type CompetitionRow,
  type CompetitionStageRow,
  type CompetitionStoreContributionRow,
  type CompetitionTeamScoreRow,
  type CompetitionTeamStoreRow,
  type CompetitionWarningRow,
} from "./competition.repository.mapper";

@Injectable()
export class CompetitionReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private hasReadScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }

  async listCompetitions(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    actorUserId?: string;
    limit: number;
    offset: number;
  }): Promise<Competition[]> {
    if (!this.hasReadScope(input) && !input.actorUserId) {
      return [];
    }

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
          store.company_id = ANY($1::uuid[])
          OR store.region_id = ANY($2::uuid[])
          OR store.store_id = ANY($3::uuid[])
          OR (
            team_store.store_id IS NULL
            AND $6::text IS NOT NULL
            AND competition.owner_user_id = $6::text
          )
        ORDER BY competition.starts_on DESC, competition.competition_code ASC
        LIMIT $4::int
        OFFSET $5::int
      `,
      [
        input.companyIds,
        input.regionIds,
        input.storeIds,
        input.limit,
        input.offset,
        input.actorUserId ?? null,
      ],
    );

    return result.rows.map(mapCompetition);
  }

  async getCompetitionDetail(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    actorUserId?: string;
  }): Promise<CompetitionBaseDetail | null> {
    if (!this.hasReadScope(input) && !input.actorUserId) {
      return null;
    }

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
            store.company_id = ANY($2::uuid[])
            OR store.region_id = ANY($3::uuid[])
            OR store.store_id = ANY($4::uuid[])
            OR (
              team_store.store_id IS NULL
              AND $5::text IS NOT NULL
              AND competition.owner_user_id = $5::text
            )
          )
      `,
      [
        input.competitionId,
        input.companyIds,
        input.regionIds,
        input.storeIds,
        input.actorUserId ?? null,
      ],
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
    if (!this.hasReadScope(input)) {
      return [];
    }

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
            store.company_id = ANY($2::uuid[])
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
          store.company_id,
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
    if (!this.hasReadScope(input)) {
      return [];
    }

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
            store.company_id = ANY($2::uuid[])
            OR store.region_id = ANY($3::uuid[])
            OR store.store_id = ANY($4::uuid[])
            OR (cardinality($2::uuid[]) > 0 AND warning.store_id IS NULL)
          )
        ORDER BY warning.warning_level DESC, warning.period_start ASC, warning.warning_code ASC
      `,
      [input.competitionId, input.companyIds, input.regionIds, input.storeIds],
    );

    return result.rows.map(mapWarning);
  }
}
