import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateSellerCodeRequestDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsIn(["create_code"])
  requestType!: "create_code";

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsString()
  @Matches(/^[0-9]{11}$/)
  nationalId!: string;

  @IsString()
  @Matches(/^(?=(?:\D*\d){10,15}\D*$)[0-9+() -]{10,20}$/)
  phoneNumber!: string;

  @IsString()
  @IsOptional()
  @Length(1, 254)
  username?: string;

  @IsString()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  @Length(5, 254)
  email!: string;

  @IsDateString()
  hireDate!: string;

  @IsPostgresUuid()
  requestedPositionId!: string;

  @IsIn(["full_time", "part_time", "temporary"])
  employmentType!: "full_time" | "part_time" | "temporary";

  @IsOptional()
  @IsString()
  @Length(2, 32)
  requestedSellerCode?: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 500)
  requestReason!: string;
}
