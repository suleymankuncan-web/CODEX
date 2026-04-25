import { IsDateString, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateCompetitionDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[A-Z0-9_]+$/)
  competitionCode!: string;

  @IsString()
  @Length(3, 160)
  competitionName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsIn(["region_challenge", "region_league", "campaign"])
  competitionType!: "region_challenge" | "region_league" | "campaign";

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}
