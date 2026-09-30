import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SetIncentiveParticipationDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period!: string;
  @IsPostgresUuid() storeId!: string;
  @IsPostgresUuid() employeeId!: string;
  @IsBoolean() included!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) reasonNote?: string;
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
  @IsPostgresUuid() expectedSnapshotId!: string;
}
