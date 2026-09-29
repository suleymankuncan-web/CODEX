import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, IsString, Length } from "class-validator";

export class StoreContactEmailDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(3, 254)
  emailAddress!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  label?: string;

  @IsBoolean()
  isPrimary!: boolean;
}
