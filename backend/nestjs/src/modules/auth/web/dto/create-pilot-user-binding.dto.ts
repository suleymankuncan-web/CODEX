import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsIn, IsString, MinLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreatePilotUserBindingDto {
  @IsPostgresUuid()
  employeeId!: string;

  @IsIn(["oidc", "clerk"])
  authProvider!: "oidc" | "clerk";

  @IsString()
  @MinLength(8)
  providerSubject!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsIn(["REGION_MANAGER", "STORE_MANAGER", "VISUAL_MERCHANDISER"])
  roleCode!: "REGION_MANAGER" | "STORE_MANAGER" | "VISUAL_MERCHANDISER";

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @IsPostgresUuid({ each: true })
  storeIds!: string[];
}
