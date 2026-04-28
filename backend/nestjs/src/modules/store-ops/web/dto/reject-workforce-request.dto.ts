import { IsString, Length } from "class-validator";

export class RejectWorkforceRequestDto {
  @IsString()
  @Length(1, 500)
  reviewNote!: string;
}
