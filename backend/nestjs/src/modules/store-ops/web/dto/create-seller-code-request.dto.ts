import { IsDateString, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateSellerCodeRequestDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsIn(["create_code"])
  requestType!: "create_code";

  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsString()
  @Matches(/^[0-9]{11}$/)
  nationalId!: string;

  @IsString()
  @Matches(/^[0-9+() -]{10,20}$/)
  phoneNumber!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,80}$/)
  username!: string;

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

  @IsOptional()
  @IsString()
  @Length(1, 500)
  requestReason?: string;
}
