import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
export class ApproveFinalIncentivePackageDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;
  @IsPostgresUuid()
  regionPackageId!: string;
  @IsDateString()
  submittedAt!: string;
  @IsOptional()
  @IsIn(["approve", "return"])
  decision?: "approve" | "return";
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
