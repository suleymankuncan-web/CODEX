import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListRequestCenterQueryDto {
  @IsOptional()
  @IsIn(["open", "done"])
  bucket?: "open" | "done";

  @IsOptional()
  @IsIn(["all", "target", "sellerCode", "offboarding", "personnelCorrection"])
  type?: "all" | "target" | "sellerCode" | "offboarding" | "personnelCorrection";

  @IsOptional()
  @IsIn(["all", "pending", "returned", "approved"])
  status?: "all" | "pending" | "returned" | "approved";

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  q?: string;

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
