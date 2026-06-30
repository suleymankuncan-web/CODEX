import { Transform } from "class-transformer";
import { IsOptional, IsString, Length } from "class-validator";

export class DeactivateUserAccountDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @Length(2, 500)
  reason?: string;
}
