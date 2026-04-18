import { IsString, MinLength } from "class-validator";

export class GrantRolePermissionDto {
  @IsString()
  @MinLength(3)
  permissionCode!: string;
}
