import { IsIn, IsOptional } from "class-validator";

export class ListSellerCodeRequestsQueryDto {
  @IsOptional()
  @IsIn(["pending_hr_approval", "approved", "rejected"])
  status?: "pending_hr_approval" | "approved" | "rejected";
}
