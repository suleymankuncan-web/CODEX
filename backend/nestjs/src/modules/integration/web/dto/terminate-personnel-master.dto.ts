import { IsISO8601, IsOptional, IsString, Length } from "class-validator";

export class TerminatePersonnelMasterDto {
  @IsISO8601({ strict: true })
  terminationDate!: string;

  @IsString()
  @Length(2, 500)
  reason!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expectedUpdatedAt?: string;
}
