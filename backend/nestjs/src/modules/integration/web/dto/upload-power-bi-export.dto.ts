import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class UploadPowerBiExportDto {
  @IsString()
  @MinLength(2)
  sourceCode!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodMonth!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
