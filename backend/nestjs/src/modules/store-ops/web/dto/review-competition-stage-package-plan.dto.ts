import { IsOptional, IsString, Length } from "class-validator";

export class ReviewCompetitionStagePackagePlanDto {
  @IsOptional()
  @IsString()
  @Length(2, 500)
  reviewNote?: string;
}
