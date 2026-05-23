import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListPilotFeedbackQueryDto {
  @IsOptional()
  @IsIn(["new", "triaged", "parked", "resolved"])
  status?: "new" | "triaged" | "parked" | "resolved";

  @IsOptional()
  @IsIn(["p0_stop", "p1_pilot_blocker", "p2_pilot_friction", "p3_backlog"])
  classification?: "p0_stop" | "p1_pilot_blocker" | "p2_pilot_friction" | "p3_backlog";

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
