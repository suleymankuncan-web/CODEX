import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateUserAccountDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsIn(["local", "oidc", "sso"])
  authProvider!: "local" | "oidc" | "sso";
}
