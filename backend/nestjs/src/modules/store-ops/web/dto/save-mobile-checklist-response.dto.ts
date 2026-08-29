import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SaveMobileChecklistResponseDto {
  @IsPostgresUuid()
  templateItemId!: string;

  @IsNumber()
  @Min(0)
  scoreValue!: number;

  @IsOptional()
  @IsIn(["compliant", "partially_compliant", "non_compliant", "not_applicable"])
  responseValue?:
    | "compliant"
    | "partially_compliant"
    | "non_compliant"
    | "not_applicable";

  @IsOptional()
  @IsString()
  commentText?: string;
}
