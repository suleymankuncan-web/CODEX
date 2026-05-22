import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateStoreActionPlanStatusDto {
  @IsIn(["open", "in_progress", "blocked"])
  status!: "open" | "in_progress" | "blocked";

  @IsOptional()
  @IsString()
  note?: string;
}
