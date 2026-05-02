import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class AddChecklistResponseDto {
  @IsPostgresUuid()
  templateItemId!: string;

  @IsOptional()
  @IsString()
  responseValue?: string;

  @IsOptional()
  @IsNumber()
  scoreValue?: number;

  @IsOptional()
  @IsBoolean()
  isNonCompliant?: boolean;

  @IsOptional()
  @IsString()
  commentText?: string;
}
