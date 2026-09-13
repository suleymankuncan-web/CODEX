import { IsBoolean } from "class-validator";
export class UpdateIncentiveApprovalDto {
  @IsBoolean()
  enabled!: boolean;
}
