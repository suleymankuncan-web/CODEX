import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class FinalizeCompetitionStageDto {
  @IsBoolean()
  allowOverride!: boolean;

  @IsOptional()
  @IsString()
  @Length(12, 1000)
  overrideJustification?: string;
}
