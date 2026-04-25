import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

class CreateCompetitionStagePackageTeamDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  teamCode!: string;

  @IsString()
  @Length(2, 160)
  teamName!: string;

  @IsOptional()
  @IsUUID()
  sourceTemplateId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  storeIds!: string[];
}

class CreateCompetitionStagePackageStageDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  stageCode!: string;

  @IsString()
  @Length(2, 160)
  stageName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageOrder!: number;

  @IsIn(["qualifier", "league", "quarter_final", "semi_final", "final", "custom"])
  stageType!: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";

  @IsOptional()
  @IsIn(["region_league", "first_half_qualifier", "final_showdown"])
  stagePresetCode?: "region_league" | "first_half_qualifier" | "final_showdown";

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateCompetitionStagePackageTeamDto)
  teams!: CreateCompetitionStagePackageTeamDto[];
}

export class CreateCompetitionStagePackageDto {
  @IsIn(["league_then_final"])
  packageCode!: "league_then_final";

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateCompetitionStagePackageStageDto)
  stages!: CreateCompetitionStagePackageStageDto[];
}
