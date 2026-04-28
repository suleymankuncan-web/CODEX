import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SaveMobileChecklistResponseDto {
  @IsPostgresUuid()
  templateItemId!: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  scoreValue!: number;

  @IsOptional()
  @IsString()
  commentText?: string;
}
