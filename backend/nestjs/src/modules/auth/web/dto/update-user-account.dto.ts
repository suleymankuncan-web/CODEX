import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class UpdateUserAccountDto {
  @IsOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsPostgresUuid()
  employeeId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @Length(3, 120)
  username?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  @Length(3, 254)
  email?: string;
}
