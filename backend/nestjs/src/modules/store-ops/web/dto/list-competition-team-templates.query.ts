import { Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class ListCompetitionTeamTemplatesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}
