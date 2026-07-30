import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class VisualComparisonAdvisoryListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class VisualComparisonAdvisoryReviewDto {
  @IsIn(["accept", "override", "reject", "recapture"])
  decision!: "accept" | "override" | "reject" | "recapture";

  @IsString() @MaxLength(500)
  reason!: string;

  @IsOptional() @IsIn(["pass", "partial", "fail"])
  finalDecision?: "pass" | "partial" | "fail";
}
