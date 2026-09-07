import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { PersonnelCorrectionRepository } from "../infrastructure/personnel-correction.repository";
import type { CreatePersonnelCorrectionDto, ReviewPersonnelCorrectionDto } from "../web/dto/personnel-correction.dto";

@Injectable()
export class PersonnelCorrectionService {
  constructor(private readonly repository: PersonnelCorrectionRepository) {}
  list(actor: AuthenticatedUser, query: { status?: string; storeId?: string; limit?: number; offset?: number }) {
    return this.repository.list(actor, query);
  }
  getPersonnel(actor: AuthenticatedUser, employeeId: string, storeId: string) {
    return this.repository.getPersonnel(actor, employeeId, storeId);
  }
  submit(actor: AuthenticatedUser, body: CreatePersonnelCorrectionDto) {
    return this.repository.submit(actor, body);
  }
  review(actor: AuthenticatedUser, requestId: string, body: ReviewPersonnelCorrectionDto) {
    return this.repository.review(actor, requestId, body);
  }
}
