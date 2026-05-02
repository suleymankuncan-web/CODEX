import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";

export class CreateIntegrationSourceDto {
  @IsString()
  @Length(2, 64)
  sourceCode!: string;

  @IsString()
  @Length(2, 128)
  sourceName!: string;

  @IsIn(["employee", "store", "kpi", "assignment", "position", "company", "region"])
  entityType!: "employee" | "store" | "kpi" | "assignment" | "position" | "company" | "region";

  @IsIn(["nebim_v3", "power_bi", "manual", "other"])
  sourceSystem: "nebim_v3" | "power_bi" | "manual" | "other" = "manual";

  @IsIn(["latest_state", "closed_period"])
  stateModel: "latest_state" | "closed_period" = "latest_state";

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pollEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  pollIntervalMinutes?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  pollWindowStartLocal?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  pollWindowEndLocal?: string;

  @IsOptional()
  @IsString()
  @Length(3, 64)
  pollTimezone?: string;
}
