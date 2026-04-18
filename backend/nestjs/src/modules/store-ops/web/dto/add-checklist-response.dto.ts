import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class AddChecklistResponseDto {
  @IsUUID()
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
