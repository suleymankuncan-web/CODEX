import { IsDateString, IsOptional } from "class-validator";

export class GetDailyClosureStatusQueryDto {
  @IsOptional()
  @IsDateString()
  referenceAt?: string;
}
