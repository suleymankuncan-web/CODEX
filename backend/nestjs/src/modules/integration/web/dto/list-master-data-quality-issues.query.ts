import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class ListMasterDataQualityIssuesQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  q?: string;

  @IsOptional()
  @IsIn(["store", "personnel", "assignment", "import"])
  entityType?: "store" | "personnel" | "assignment" | "import";

  @IsOptional()
  @IsIn(["critical", "warning", "info"])
  severity?: "critical" | "warning" | "info";

  @IsOptional()
  @IsString()
  @Length(1, 96)
  issueCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
