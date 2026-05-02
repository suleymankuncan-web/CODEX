import { IsDateString, IsOptional } from "class-validator";

export class ListDueIntegrationSourcesQueryDto {
  @IsOptional()
  @IsDateString()
  referenceAt?: string;
}
