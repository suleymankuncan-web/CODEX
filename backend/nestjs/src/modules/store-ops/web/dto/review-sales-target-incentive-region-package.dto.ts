import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ReviewSalesTargetIncentiveRegionPackageDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsPostgresUuid()
  regionId!: string;

  @IsIn(["approve", "return"])
  decision!: "approve" | "return";

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reviewNote?: string;
}
