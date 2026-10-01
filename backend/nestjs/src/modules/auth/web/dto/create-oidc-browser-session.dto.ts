import { IsString, Length, Matches } from "class-validator";

export class CreateOidcBrowserSessionDto {
  @IsString()
  @Length(1, 4096)
  code!: string;

  @IsString()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9._~-]+$/)
  codeVerifier!: string;

  @IsString()
  @Length(16, 256)
  @Matches(/^[A-Za-z0-9_-]+$/)
  state!: string;

  @IsString()
  @Length(1, 2048)
  redirectUri!: string;
}
