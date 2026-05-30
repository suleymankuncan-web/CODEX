import { Module } from "@nestjs/common";
import { CompetitionController } from "./web/competition.controller";
import { CompetitionService } from "./application/competition.service";
import { CompetitionReadRepository } from "./infrastructure/competition-read.repository";
import { CompetitionRepository } from "./infrastructure/competition.repository";
import { CompetitionStagePackagePlanReadRepository } from "./infrastructure/competition-stage-package-plan-read.repository";
import { CompetitionTeamTemplateCommandRepository } from "./infrastructure/competition-team-template-command.repository";
import { CompetitionTeamTemplateReadRepository } from "./infrastructure/competition-team-template-read.repository";

@Module({
  controllers: [CompetitionController],
  providers: [
    CompetitionService,
    CompetitionRepository,
    CompetitionReadRepository,
    CompetitionStagePackagePlanReadRepository,
    CompetitionTeamTemplateReadRepository,
    CompetitionTeamTemplateCommandRepository,
  ],
  exports: [CompetitionService],
})
export class StoreOpsCompetitionModule {}
