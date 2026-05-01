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

  @IsIn(["local", "oidc", "sso", "clerk"])
  authProvider!: "local" | "oidc" | "sso" | "clerk";

  @IsOptional()
  @IsString()
  @MinLength(8)
  providerSubject?: string;
}
