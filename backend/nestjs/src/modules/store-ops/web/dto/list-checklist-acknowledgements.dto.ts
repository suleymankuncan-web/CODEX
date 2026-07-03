import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, Matches, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListChecklistAcknowledgementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @IsOptional()
  @IsIn(["pending_acknowledgement", "acknowledged"])
  status?: "pending_acknowledgement" | "acknowledged";

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsPostgresUuid()
  checklistInstanceId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeResponses?: boolean;
}
