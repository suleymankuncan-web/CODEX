import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Length, Matches, ValidateIf } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class UpdateUserAccountDto {
  @IsOptional()
  @Transform(({ value }) => (value === "" ? null : value))
  @IsPostgresUuid()
  employeeId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{2,119}$/i)
  username?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  firstName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  @Length(3, 254)
  email?: string;
}
