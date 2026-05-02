import { IsOptional, IsString, Length, Matches } from "class-validator";

export class CloneCompetitionTeamTemplateDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  templateCode!: string;

  @IsString()
  @Length(2, 160)
  templateName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
