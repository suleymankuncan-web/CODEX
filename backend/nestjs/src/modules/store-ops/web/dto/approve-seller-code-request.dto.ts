import { IsOptional, IsString, Length } from "class-validator";

export class ApproveSellerCodeRequestDto {
  @IsString()
  @Length(2, 32)
  sellerCode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reviewNote?: string;
}
