import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateUserAccountDto {
  @IsOptional()
  @IsPostgresUuid()
  employeeId?: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsIn(["local", "oidc", "sso"])
  authProvider!: "local" | "oidc" | "sso";
}
