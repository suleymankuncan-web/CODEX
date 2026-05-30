import { createHash } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "../infrastructure/workforce-request.repository";
import {
  WORKFORCE_OFFBOARDING_TRANSITIONS,
  WORKFORCE_SELLER_CODE_TRANSITIONS,
  canApplyWorkforceRequestTransition,
  type WorkforceRequestStatus,
} from "./workforce-request-transition.policy";

@Injectable()
export class WorkforceService {
  constructor(
    private readonly storeOpsRepository: StoreOpsRepository,
    private readonly workforceRequestRepository: WorkforceRequestRepository,
  ) {}

  async getStoreHeadcountGap(input: {
    storeId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.storeOpsRepository.getStoreHeadcountGap(input);
  }

  async getSellerCodeReference(storeType: "franchise") {
    const lastSellerCode = await this.workforceRequestRepository.getLatestFranchiseSellerCode();

    return {
      storeType,
      prefix: "FM",
      lastSellerCode,
      nextSellerCodePreview: this.getNextFmCode(lastSellerCode),
    };
  }

  async listSellerCodeRequests(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
    status?: WorkforceRequestStatus;
  }) {
    const listScope = this.resolveWorkforceRequestListScope(input);
    const rows = await this.workforceRequestRepository.listSellerCodeRequests({
      companyIds: listScope.companyIds,
      regionIds: listScope.regionIds,
      storeIds: listScope.storeIds,
      status: input.status,
    });

    return buildListResponse(
      rows.map((row) => this.mapSellerCodeRequest(row)),
      {
        total: rows.length,
        limit: rows.length || 50,
        offset: 0,
      },
    );
  }

  async listPositionOptions(input: {
    actorScope: {
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const rows = await this.workforceRequestRepository.listPositionOptionsForStore({
      storeId: input.storeId,
    });

    return buildListResponse(
      rows.map((row) => ({
        positionId: row.position_id,
        positionCode: row.position_code,
        positionName: row.position_name,
        jobFamily: row.job_family,
        isManagerial: row.is_managerial,
      })),
      {
        total: rows.length,
        limit: rows.length || 50,
        offset: 0,
      },
    );
  }

  async listActiveStoreEmployees(input: {
    actorScope: {
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const rows = await this.workforceRequestRepository.listActiveStoreEmployees({
      storeId: input.storeId,
    });

    return buildListResponse(
      rows.map((row) => ({
        employeeId: row.employee_id,
        displayName: `${row.first_name} ${row.last_name}`.trim(),
        externalEmployeeRef: row.external_employee_ref,
        storeId: row.store_id,
        positionId: row.position_id,
        positionCode: row.position_code,
        positionName: row.position_name,
        assignmentStartDate: row.assignment_start_date,
        employmentStatus: row.employment_status,
      })),
      {
        total: rows.length,
        limit: rows.length || 50,
        offset: 0,
      },
    );
  }

  async createSellerCodeRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
    requestType: "create_code";
    firstName: string;
    lastName: string;
    nationalId: string;
    phoneNumber: string;
    hireDate: string;
    requestedPositionId: string;
    employmentType: "full_time" | "part_time" | "temporary";
    requestedSellerCode?: string;
    requestReason?: string;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const store = await this.workforceRequestRepository.getStoreForSellerCodeRequest(input.storeId);
    if (!store) {
      throw new NotFoundException(`Store not found: ${input.storeId}`);
    }

    const lastReferenceSellerCode =
      store.store_type === "franchise"
        ? await this.workforceRequestRepository.getLatestFranchiseSellerCode()
        : null;

    const request = await this.workforceRequestRepository.createSellerCodeRequest({
      companyId: store.company_id,
      regionId: store.region_id,
      storeId: store.store_id,
      storeType: store.store_type,
      requestType: input.requestType,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      nationalIdHash: this.hashNationalId(input.nationalId),
      nationalIdLast4: input.nationalId.slice(-4),
      phoneNumber: input.phoneNumber.trim(),
      hireDate: input.hireDate,
      requestedPositionId: input.requestedPositionId,
      employmentType: input.employmentType,
      lastReferenceSellerCode,
      requestReason: input.requestReason?.trim(),
      submittedByUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "submitted",
      message: "Seller code request submitted for HR approval",
      data: {
        request: this.mapSellerCodeRequest(request),
      },
    });
  }

  async approveSellerCodeRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorRoleCodes: string[];
    requestId: string;
    sellerCode: string;
    reviewNote?: string;
  }) {
    const existing = await this.workforceRequestRepository.getSellerCodeRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Seller code request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_SELLER_CODE_TRANSITIONS.approve,
      )
    ) {
      throw new BadRequestException("Seller code request is not pending HR approval");
    }

    this.assertCanReviewWorkforceRequest(input, existing);

    const sellerCode = input.sellerCode.trim().toUpperCase();
    if (existing.store_type === "franchise" && !/^FM\d+$/.test(sellerCode)) {
      throw new BadRequestException("Franchise seller code must use FM followed by digits");
    }

    const duplicateCount = await this.workforceRequestRepository.countSellerCodeDuplicates(sellerCode);
    if (duplicateCount > 0) {
      throw new BadRequestException(`Seller code already exists: ${sellerCode}`);
    }

    const request = await this.workforceRequestRepository.approveSellerCodeRequest({
      request: existing,
      sellerCode,
      actorUserId: input.actorUserId,
      reviewNote: input.reviewNote?.trim(),
    });

    return buildCommandResponse({
      status: "approved",
      message: "Seller code request approved",
      data: {
        request: this.mapSellerCodeRequest(request),
      },
    });
  }

  async rejectSellerCodeRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorRoleCodes: string[];
    requestId: string;
    reviewNote: string;
  }) {
    const existing = await this.workforceRequestRepository.getSellerCodeRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Seller code request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_SELLER_CODE_TRANSITIONS.reject,
      )
    ) {
      throw new BadRequestException("Seller code request is not pending HR approval");
    }

    this.assertCanReviewWorkforceRequest(input, existing);

    const reviewNote = input.reviewNote.trim();
    if (!reviewNote) {
      throw new BadRequestException("Review note is required when returning a seller code request");
    }

    const request = await this.workforceRequestRepository.rejectSellerCodeRequest({
      request: existing,
      actorUserId: input.actorUserId,
      reviewNote,
    });

    return buildCommandResponse({
      status: "rejected",
      message: "Seller code request returned to store",
      data: {
        request: this.mapSellerCodeRequest(request),
      },
    });
  }

  async resubmitSellerCodeRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    requestId: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    phoneNumber: string;
    hireDate: string;
    requestedPositionId: string;
    employmentType: "full_time" | "part_time" | "temporary";
    requestReason?: string;
  }) {
    const existing = await this.workforceRequestRepository.getSellerCodeRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Seller code request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_SELLER_CODE_TRANSITIONS.resubmit,
      )
    ) {
      throw new BadRequestException("Only rejected seller code requests can be resubmitted");
    }

    if (!this.canActOnStore(input.actorActionScope, input.actorScope, existing.store_id)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const lastReferenceSellerCode =
      existing.store_type === "franchise"
        ? await this.workforceRequestRepository.getLatestFranchiseSellerCode()
        : null;

    const request = await this.workforceRequestRepository.resubmitSellerCodeRequest({
      request: existing,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      nationalIdHash: this.hashNationalId(input.nationalId),
      nationalIdLast4: input.nationalId.slice(-4),
      phoneNumber: input.phoneNumber.trim(),
      hireDate: input.hireDate,
      requestedPositionId: input.requestedPositionId,
      employmentType: input.employmentType,
      requestReason: input.requestReason?.trim(),
      lastReferenceSellerCode,
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "resubmitted",
      message: "Seller code request resubmitted for HR approval",
      data: {
        request: this.mapSellerCodeRequest(request),
      },
    });
  }

  async listOffboardingRequests(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
    status?: WorkforceRequestStatus;
  }) {
    const listScope = this.resolveWorkforceRequestListScope(input);
    const rows = await this.workforceRequestRepository.listOffboardingRequests({
      companyIds: listScope.companyIds,
      regionIds: listScope.regionIds,
      storeIds: listScope.storeIds,
      status: input.status,
    });

    return buildListResponse(
      rows.map((row) => this.mapOffboardingRequest(row)),
      {
        total: rows.length,
        limit: rows.length || 50,
        offset: 0,
      },
    );
  }

  async createOffboardingRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
    employeeId: string;
    terminationDate: string;
    terminationReason: string;
    requestReason: string;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const employee = await this.workforceRequestRepository.getActiveStoreEmployeeForOffboarding({
      storeId: input.storeId,
      employeeId: input.employeeId,
    });
    if (!employee) {
      throw new NotFoundException(`Active employee not found for store: ${input.employeeId}`);
    }

    const request = await this.workforceRequestRepository.createOffboardingRequest({
      companyId: employee.company_id,
      regionId: employee.region_id,
      storeId: employee.store_id,
      employeeId: employee.employee_id,
      terminationDate: input.terminationDate,
      terminationReason: input.terminationReason.trim(),
      requestReason: input.requestReason.trim(),
      submittedByUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "submitted",
      message: "Offboarding request submitted for HR approval",
      data: {
        request: this.mapOffboardingRequest(request),
      },
    });
  }

  async approveOffboardingRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorRoleCodes: string[];
    requestId: string;
    reviewNote?: string;
  }) {
    const existing = await this.workforceRequestRepository.getOffboardingRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Offboarding request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_OFFBOARDING_TRANSITIONS.approve,
      )
    ) {
      throw new BadRequestException("Offboarding request is not pending HR approval");
    }

    this.assertCanReviewWorkforceRequest(input, existing);

    const approval = await this.workforceRequestRepository.approveOffboardingRequest({
      request: existing,
      actorUserId: input.actorUserId,
      reviewNote: input.reviewNote?.trim(),
    });

    return buildCommandResponse({
      status: "approved",
      message: "Offboarding request approved",
      data: {
        request: this.mapOffboardingRequest(approval.request),
        accessClosure: approval.accessClosure,
      },
    });
  }

  async rejectOffboardingRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorRoleCodes: string[];
    requestId: string;
    reviewNote: string;
  }) {
    const existing = await this.workforceRequestRepository.getOffboardingRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Offboarding request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_OFFBOARDING_TRANSITIONS.reject,
      )
    ) {
      throw new BadRequestException("Offboarding request is not pending HR approval");
    }

    this.assertCanReviewWorkforceRequest(input, existing);

    const reviewNote = input.reviewNote.trim();
    if (!reviewNote) {
      throw new BadRequestException("Review note is required when returning an offboarding request");
    }

    const request = await this.workforceRequestRepository.rejectOffboardingRequest({
      request: existing,
      actorUserId: input.actorUserId,
      reviewNote,
    });

    return buildCommandResponse({
      status: "rejected",
      message: "Offboarding request returned to store",
      data: {
        request: this.mapOffboardingRequest(request),
      },
    });
  }

  async resubmitOffboardingRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    requestId: string;
    employeeId: string;
    terminationDate: string;
    terminationReason: string;
    requestReason: string;
  }) {
    const existing = await this.workforceRequestRepository.getOffboardingRequestById(input.requestId);
    if (!existing) {
      throw new NotFoundException(`Offboarding request not found: ${input.requestId}`);
    }

    if (
      !canApplyWorkforceRequestTransition(
        existing.request_status,
        WORKFORCE_OFFBOARDING_TRANSITIONS.resubmit,
      )
    ) {
      throw new BadRequestException("Only rejected offboarding requests can be resubmitted");
    }

    if (!this.canActOnStore(input.actorActionScope, input.actorScope, existing.store_id)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const employee = await this.workforceRequestRepository.getActiveStoreEmployeeForOffboarding({
      storeId: existing.store_id,
      employeeId: input.employeeId,
    });
    if (!employee) {
      throw new NotFoundException(`Active employee not found for store: ${input.employeeId}`);
    }

    const request = await this.workforceRequestRepository.resubmitOffboardingRequest({
      request: existing,
      companyId: employee.company_id,
      regionId: employee.region_id,
      storeId: employee.store_id,
      employeeId: employee.employee_id,
      terminationDate: input.terminationDate,
      terminationReason: input.terminationReason.trim(),
      requestReason: input.requestReason.trim(),
      actorUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "resubmitted",
      message: "Offboarding request resubmitted for HR approval",
      data: {
        request: this.mapOffboardingRequest(request),
      },
    });
  }

  private getNextFmCode(lastSellerCode: string | null) {
    if (!lastSellerCode) {
      return "FM1";
    }

    const match = /^FM(\d+)$/i.exec(lastSellerCode);
    if (!match) {
      return null;
    }

    return `FM${Number(match[1]) + 1}`;
  }

  private hashNationalId(nationalId: string) {
    return createHash("sha256").update(nationalId.trim()).digest("hex");
  }

  private canActOnStore(
    actionScope: { assignedStoreIds: string[] } | undefined,
    legacyScope: { storeIds: string[] },
    storeId: string,
  ) {
    const assignedStoreIds = actionScope?.assignedStoreIds ?? legacyScope.storeIds;
    return assignedStoreIds.includes(storeId);
  }

  private assertCanReviewWorkforceRequest(
    input: {
      actorScope: {
        companyIds: string[];
        regionIds: string[];
        storeIds: string[];
      };
      actorRoleCodes: string[];
    },
    request: {
      company_id: string;
      region_id: string;
      store_id: string;
    },
  ) {
    if (input.actorRoleCodes.includes("SUPER_ADMIN")) {
      return;
    }

    const isInScope =
      input.actorScope.companyIds.includes(request.company_id) ||
      input.actorScope.regionIds.includes(request.region_id) ||
      input.actorScope.storeIds.includes(request.store_id);

    if (!isInScope) {
      throw new ForbiddenException("Workforce request is outside actor review scope");
    }
  }

  private resolveWorkforceRequestListScope(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
  }) {
    const canUseBroadReadScope = input.actorRoleCodes.some((roleCode) =>
      ["HR_ADMIN", "SUPER_ADMIN"].includes(roleCode),
    );
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (!canUseBroadReadScope) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    return {
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : storeIds,
    };
  }

  private mapSellerCodeRequest(row: {
    seller_code_request_id: string;
    company_id: string;
    region_id: string;
    store_id: string;
    store_code: string;
    store_name: string;
    store_type: string;
    request_type: string;
    request_status: string;
    first_name: string;
    last_name: string;
    national_id_last4: string;
    phone_number: string;
    requested_hire_date: string;
    requested_position_id: string;
    position_code: string;
    position_name: string;
    employment_type: string;
    requested_seller_code: string | null;
    approved_seller_code: string | null;
    last_reference_seller_code: string | null;
    submitted_by_user_id: string;
    reviewed_by_user_id: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
    updated_at: string;
    employee_id?: string | null;
  }) {
    return {
      requestId: row.seller_code_request_id,
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
      storeCode: row.store_code,
      storeName: row.store_name,
      storeType: row.store_type,
      requestType: row.request_type,
      status: row.request_status,
      firstName: row.first_name,
      lastName: row.last_name,
      nationalIdLast4: row.national_id_last4,
      phoneNumber: row.phone_number,
      hireDate: row.requested_hire_date,
      requestedPositionId: row.requested_position_id,
      positionCode: row.position_code,
      positionName: row.position_name,
      employmentType: row.employment_type,
      requestedSellerCode: row.requested_seller_code,
      approvedSellerCode: row.approved_seller_code,
      lastReferenceSellerCode: row.last_reference_seller_code,
      submittedByUserId: row.submitted_by_user_id,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      employeeId: row.employee_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapOffboardingRequest(row: {
    offboarding_request_id: string;
    company_id: string;
    region_id: string;
    store_id: string;
    store_code: string;
    store_name: string;
    employee_id: string;
    external_employee_ref: string | null;
    first_name: string;
    last_name: string;
    position_code: string | null;
    position_name: string | null;
    request_status: string;
    requested_termination_date: string;
    termination_reason: string;
    request_reason: string | null;
    submitted_by_user_id: string;
    reviewed_by_user_id: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
    updated_at: string;
  }) {
    return {
      requestId: row.offboarding_request_id,
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
      storeCode: row.store_code,
      storeName: row.store_name,
      employeeId: row.employee_id,
      displayName: `${row.first_name} ${row.last_name}`.trim(),
      externalEmployeeRef: row.external_employee_ref,
      positionCode: row.position_code,
      positionName: row.position_name,
      status: row.request_status,
      terminationDate: row.requested_termination_date,
      terminationReason: row.termination_reason,
      requestReason: row.request_reason,
      submittedByUserId: row.submitted_by_user_id,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
