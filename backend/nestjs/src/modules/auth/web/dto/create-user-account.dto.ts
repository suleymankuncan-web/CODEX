import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength, ValidateIf } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateUserAccountDto {
  @IsOptional()
  @IsPostgresUuid()
  employeeId?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^[a-z0-9][a-z0-9._-]{2,119}$/i)
  username!: string;

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

  @IsEmail()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  email!: string;

  @IsIn(["local", "oidc", "sso", "clerk"])
  authProvider!: "local" | "oidc" | "sso" | "clerk";

  @IsOptional()
  @IsString()
  @MinLength(8)
  providerSubject?: string;
}
