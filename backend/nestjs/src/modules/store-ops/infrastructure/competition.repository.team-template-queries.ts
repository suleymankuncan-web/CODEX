import { type Queryable } from "./competition.repository.db";
import { type CompetitionTeamTemplateStoreRow } from "./competition.repository.mapper";

export async function queryTeamTemplateRows(
  queryable: Queryable,
  input: {
    templateId?: string;
    activeOnly: boolean;
    companyIds?: string[];
    regionIds?: string[];
    storeIds?: string[];
  },
): Promise<CompetitionTeamTemplateStoreRow[]> {
  const params: unknown[] = [input.activeOnly];
  const clauses = ["($1::boolean = FALSE OR template.is_active = TRUE)"];

  if (input.templateId) {
    params.push(input.templateId);
    clauses.push(`template.competition_team_template_id = $${params.length}::uuid`);
  }

  if (input.companyIds || input.regionIds || input.storeIds) {
    params.push(input.companyIds ?? []);
    const companyParam = params.length;
    params.push(input.regionIds ?? []);
    const regionParam = params.length;
    params.push(input.storeIds ?? []);
    const storeParam = params.length;

    clauses.push(`
        EXISTS (
          SELECT 1
          FROM ops.competition_team_template_store scoped_template_store
          INNER JOIN ops.store scoped_store
            ON scoped_store.store_id = scoped_template_store.store_id
          WHERE scoped_template_store.competition_team_template_id = template.competition_team_template_id
            AND (
              scoped_store.company_id = ANY($${companyParam}::uuid[])
              OR scoped_store.region_id = ANY($${regionParam}::uuid[])
              OR scoped_store.store_id = ANY($${storeParam}::uuid[])
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ops.competition_team_template_store outside_template_store
          INNER JOIN ops.store outside_store
            ON outside_store.store_id = outside_template_store.store_id
          WHERE outside_template_store.competition_team_template_id = template.competition_team_template_id
            AND NOT (
              outside_store.company_id = ANY($${companyParam}::uuid[])
              OR outside_store.region_id = ANY($${regionParam}::uuid[])
              OR outside_store.store_id = ANY($${storeParam}::uuid[])
            )
        )
      `);
  }

  const result = await queryable.query<CompetitionTeamTemplateStoreRow>(
    `
        SELECT
          template.competition_team_template_id,
          template.template_code,
          template.template_name,
          template.description,
          template.is_active,
          store.store_id,
          store.store_code,
          store.store_name,
          store.company_id,
          store.region_id
        FROM ops.competition_team_template template
        LEFT JOIN ops.competition_team_template_store template_store
          ON template_store.competition_team_template_id = template.competition_team_template_id
        LEFT JOIN ops.store store
          ON store.store_id = template_store.store_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY template.template_code ASC, store.store_code ASC
      `,
    params,
  );

  return result.rows;
}
