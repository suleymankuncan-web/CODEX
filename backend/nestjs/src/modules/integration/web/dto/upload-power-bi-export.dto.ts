import { IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class UploadPowerBiExportDto {
  @IsString()
  @MinLength(2)
  sourceCode!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodMonth?: string;

  @IsOptional()
  @IsString()
  @IsIn(["daily", "weekly", "monthly", "custom"])
  periodType?: "daily" | "weekly" | "monthly" | "custom";

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEnd?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
