import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { PersonnelMasterReadRepository } from "../infrastructure/personnel-master-read.repository";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { logStructuredMessage } from "../../../shared/structured-log";
import { assertCompanyScope, normalizeCompanyScope } from "./integration-company-scope";
import { mapPersonnelMaster } from "./integration-read-model.helpers";
import { buildPersonnelMasterWorkbook } from "./personnel-master-export";
import { buildPersonnelMasterIdentity } from "./personnel-master-identity";

type PersonnelWriteInput = {
  actorCompanyIds: string[];
  actorUserId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  externalEmployeeRef?: string;
  phoneNumber?: string;
  employmentStatus: "active" | "inactive";
  employmentType: "full_time" | "part_time" | "temporary";
  hireDate: string;
  storeId: string;
  positionId: string;
  assignmentStartDate?: string;
  expectedUpdatedAt?: string;
};

@Injectable()
export class PersonnelMasterService {
  private readonly logger = new Logger(PersonnelMasterService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly readRepository: PersonnelMasterReadRepository,
  ) {}

  async list(input: {
    actorCompanyIds: string[];
    q?: string;
    status?: "active" | "inactive" | "terminated";
    storeId?: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = scopedCompanies(input.actorCompanyIds);
    const result = await this.readRepository.listPersonnelMaster({ ...input, actorCompanyIds });
    return buildListResponse(result.rows.map(mapPersonnelMaster), {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async export(input: { actorCompanyIds: string[] }) {
    const actorCompanyIds = scopedCompanies(input.actorCompanyIds);
    const items: ReturnType<typeof mapPersonnelMaster>[] = [];
    for (const status of ["active", "inactive", "terminated"] as const) {
      let offset = 0;
      const limit = 200;
      let hasMore = true;
      while (hasMore) {
        const result = await this.readRepository.listPersonnelMaster({ actorCompanyIds, status, limit, offset });
        items.push(...result.rows.map(mapPersonnelMaster));
        offset += result.rows.length;
        hasMore = result.rows.length > 0 && offset < result.total;
      }
    }
    return {
      buffer: buildPersonnelMasterWorkbook(items),
      fileName: `personel-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`,
    };
  }

  async getLookups(input: { actorCompanyIds: string[] }) {
    const lookups = await this.readRepository.listPersonnelMasterLookups({
      actorCompanyIds: scopedCompanies(input.actorCompanyIds),
    });
    return {
      stores: lookups.stores.map((item) => ({
        storeId: item.store_id,
        storeCode: item.store_code,
        storeName: item.store_name,
        regionId: item.region_id,
        regionName: item.region_name,
      })),
      positions: lookups.positions.map((item) => ({
        positionId: item.position_id,
        positionCode: item.position_code,
        positionName: item.position_name,
        isManagerial: item.is_managerial,
      })),
      employmentStatuses: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "terminated", label: "Terminated" },
      ],
      employmentTypes: [
        { value: "full_time", label: "Full time" },
        { value: "part_time", label: "Part time" },
        { value: "temporary", label: "Temporary" },
      ],
    };
  }

  async update(input: PersonnelWriteInput) {
    const personnel = await this.integrationRepository.updatePersonnelMaster({
      ...input,
      actorCompanyIds: scopedCompanies(input.actorCompanyIds),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      externalEmployeeRef: input.externalEmployeeRef?.trim(),
      phoneNumber: input.phoneNumber?.trim(),
      hireDate: input.hireDate.slice(0, 10),
      assignmentStartDate: input.assignmentStartDate?.slice(0, 10),
    });
    if (!personnel) throw new NotFoundException(`Personnel master record not found: ${input.employeeId}`);
    logStructuredMessage(this.logger, "personnel_master_data.updated", {
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      storeId: input.storeId,
      positionId: input.positionId,
      employmentStatus: input.employmentStatus,
    });
    return buildCommandResponse({
      status: "updated",
      message: "Personnel master data updated",
      data: { personnelMaster: mapPersonnelMaster(personnel) },
    });
  }

  async create(input: Omit<PersonnelWriteInput, "employeeId" | "employmentStatus" | "assignmentStartDate" | "expectedUpdatedAt"> & {
    nationalId: string;
    phoneNumber: string;
  }) {
    const identity = buildPersonnelMasterIdentity(input);
    const personnel = await this.integrationRepository.createPersonnelMaster({
      actorCompanyIds: scopedCompanies(input.actorCompanyIds),
      actorUserId: input.actorUserId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      externalEmployeeRef: input.externalEmployeeRef?.trim(),
      ...identity,
      employmentType: input.employmentType,
      hireDate: input.hireDate.slice(0, 10),
      storeId: input.storeId,
      positionId: input.positionId,
    });
    if (!personnel) throw new NotFoundException("Store or position not found for personnel entry");
    logStructuredMessage(this.logger, "personnel_master_data.created", {
      actorUserId: input.actorUserId,
      employeeId: personnel.employee_id,
      storeId: input.storeId,
    });
    return buildCommandResponse({
      status: "created",
      message: "Personnel master data created",
      data: { personnelMaster: mapPersonnelMaster(personnel) },
    });
  }

  async terminate(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    employeeId: string;
    terminationDate: string;
    reason: string;
    expectedUpdatedAt?: string;
  }) {
    const terminationDate = input.terminationDate.slice(0, 10);
    if (terminationDate > formatBusinessDate(new Date())) {
      throw new BadRequestException("Termination date cannot be in the future");
    }
    const terminated = await this.integrationRepository.terminatePersonnelMaster({
      ...input,
      actorCompanyIds: scopedCompanies(input.actorCompanyIds),
      terminationDate,
      reason: input.reason.trim(),
    });
    if (!terminated?.employee_id) {
      throw new NotFoundException(`Personnel master record not found: ${input.employeeId}`);
    }
    const { accessClosure, ...personnel } = terminated;
    logStructuredMessage(this.logger, "personnel_master_data.terminated", {
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      terminationDate,
      userAccessClosed: accessClosure.userAccessClosed,
    });
    return buildCommandResponse({
      status: "updated",
      message: "Personnel exit completed and linked access closed",
      data: { personnelMaster: mapPersonnelMaster(personnel), accessClosure },
    });
  }
}

function scopedCompanies(companyIds: string[]) {
  const normalized = normalizeCompanyScope(companyIds);
  assertCompanyScope(normalized);
  return normalized;
}

function formatBusinessDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.BUSINESS_TIME_ZONE ?? "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
