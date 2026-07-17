import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

export class GetTaskCommandWorkspaceQueryDto {
  @IsDateString({ strict: true })
  periodStart!: string;

  @IsDateString({ strict: true })
  periodEnd!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class GetTaskCommandEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
