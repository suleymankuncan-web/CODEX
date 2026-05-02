import { IsDateString, IsOptional } from "class-validator";

export class PublishChecklistTemplateDto {
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
