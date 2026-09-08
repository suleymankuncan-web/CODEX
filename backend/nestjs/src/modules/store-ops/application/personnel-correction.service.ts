import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { PersonnelCorrectionRepository } from "../infrastructure/personnel-correction.repository";
import type { CreatePersonnelCorrectionInput, ReviewPersonnelCorrectionInput } from "../application/personnel-correction.types";

@Injectable()
export class PersonnelCorrectionService {
  constructor(private readonly repository: PersonnelCorrectionRepository) {}
  list(actor: AuthenticatedUser, query: { status?: string; storeId?: string; limit?: number; offset?: number }) {
    return this.repository.list(actor, query);
  }
  getPersonnel(actor: AuthenticatedUser, employeeId: string, storeId: string) {
    return this.repository.getPersonnel(actor, employeeId, storeId);
  }
  submit(actor: AuthenticatedUser, body: CreatePersonnelCorrectionInput) {
    return this.repository.submit(actor, body);
  }
  review(actor: AuthenticatedUser, requestId: string, body: ReviewPersonnelCorrectionInput) {
    return this.repository.review(actor, requestId, body);
  }
}
