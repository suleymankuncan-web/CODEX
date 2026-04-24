import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";

export class UpdateIntegrationSourceScheduleDto {
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
