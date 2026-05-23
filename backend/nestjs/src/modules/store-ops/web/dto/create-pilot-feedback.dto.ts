import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePilotFeedbackDto {
  @IsIn(["bug", "friction", "idea", "data_quality", "other"])
  feedbackType!: "bug" | "friction" | "idea" | "data_quality" | "other";

  @IsIn(["p0", "p1", "p2", "p3"])
  severitySuggestion!: "p0" | "p1" | "p2" | "p3";

  @IsString()
  @MaxLength(300)
  routePath!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  pageTitle?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;
}
