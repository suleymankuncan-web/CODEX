import { ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateMasterDataBootstrapBatchDto {
  @IsIn(["store", "personnel"])
  bootstrapEntity!: "store" | "personnel";

  @IsString()
  @MinLength(3)
  sourceLabel!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  fileReference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  rows!: Record<string, unknown>[];
}
