import { IsDateString, IsOptional } from "class-validator";

export class RunDailyClosureDto {
  @IsOptional()
  @IsDateString()
  closureDate?: string;

  @IsOptional()
  @IsDateString()
  referenceAt?: string;
}
