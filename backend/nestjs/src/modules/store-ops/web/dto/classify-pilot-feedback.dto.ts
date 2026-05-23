import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ClassifyPilotFeedbackDto {
  @IsIn(["p0_stop", "p1_pilot_blocker", "p2_pilot_friction", "p3_backlog"])
  classification!: "p0_stop" | "p1_pilot_blocker" | "p2_pilot_friction" | "p3_backlog";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
