import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterMobileSessionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  deviceId!: string;

  @IsIn(["ios", "android"])
  platform!: "ios" | "android";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osVersion?: string;
}
