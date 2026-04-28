import { IsIn } from "class-validator";

export class SellerCodeReferenceQueryDto {
  @IsIn(["franchise"])
  storeType!: "franchise";
}
