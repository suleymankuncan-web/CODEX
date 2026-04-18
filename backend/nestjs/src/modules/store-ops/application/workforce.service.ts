import { Injectable } from "@nestjs/common";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";

@Injectable()
export class WorkforceService {
  constructor(private readonly storeOpsRepository: StoreOpsRepository) {}

  async getStoreHeadcountGap(input: {
    storeId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.storeOpsRepository.getStoreHeadcountGap(input);
  }
}
