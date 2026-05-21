import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { CompetitionTeamTemplate } from "../application/competition.contract";
import { mapTeamTemplates } from "./competition.repository.mapper";
import { queryTeamTemplateRows } from "./competition.repository.team-template-queries";

@Injectable()
export class CompetitionTeamTemplateReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listTeamTemplates(input: {
    activeOnly?: boolean;
    companyIds?: string[];
    regionIds?: string[];
    storeIds?: string[];
  } = {}): Promise<CompetitionTeamTemplate[]> {
    const rows = await queryTeamTemplateRows(this.databaseService, {
      activeOnly: input.activeOnly ?? true,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
    });

    return mapTeamTemplates(rows);
  }
}
