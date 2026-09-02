import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  AuthActionScope,
  AuthReadScope,
} from "../../auth/auth-context.service";
import { ChecklistService } from "./checklist.service";
import {
  ChecklistResultPdf,
  ChecklistResultPdfRenderer,
} from "./checklist-result-pdf.renderer";

type ChecklistResultPdfInput = {
  checklistInstanceId: string;
  actorScope: AuthReadScope;
  actorActionScope?: AuthActionScope;
  actorRoleCodes: string[];
  actorReadScope?: AuthReadScope;
};

type ChecklistAcknowledgementResult = {
  checklistInstanceId?: string | null;
  completedAt?: string | Date | null;
  status?: string | null;
  [key: string]: unknown;
};

type ChecklistAcknowledgementListResult = {
  items?: ChecklistAcknowledgementResult[];
  data?: {
    items?: ChecklistAcknowledgementResult[];
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ChecklistResultPdfService {
  constructor(
    private readonly checklistService: ChecklistService,
    private readonly renderer: ChecklistResultPdfRenderer,
  ) {}

  async exportChecklistResultPdf(input: ChecklistResultPdfInput): Promise<ChecklistResultPdf> {
    this.assertExportRole(input.actorRoleCodes);
    if (!UUID_PATTERN.test(input.checklistInstanceId)) {
      throw new BadRequestException("Checklist instance id must be a UUID");
    }

    const page = (await this.checklistService.listChecklistAcknowledgements({
      actorScope: input.actorScope,
      actorRoleCodes: input.actorRoleCodes,
      checklistInstanceId: input.checklistInstanceId,
      includeResponses: true,
      limit: 1,
      offset: 0,
      ...(input.actorActionScope ? { actorActionScope: input.actorActionScope } : {}),
      ...(input.actorReadScope ? { actorReadScope: input.actorReadScope } : {}),
    })) as ChecklistAcknowledgementListResult;

    const item = this.firstItem(page);
    if (
      !item ||
      item.checklistInstanceId !== input.checklistInstanceId ||
      item.status !== "completed" ||
      !isValidDate(item.completedAt)
    ) {
      throw new NotFoundException("Checklist result was not found");
    }

    try {
      const buffer = await this.renderer.render(item);
      return {
        buffer,
        fileName: this.renderer.fileName(item.completedAt),
      };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      throw new InternalServerErrorException("Checklist result PDF could not be rendered");
    }
  }

  private assertExportRole(roleCodes: readonly string[]) {
    if (
      !roleCodes.includes("REGION_MANAGER") &&
      !roleCodes.includes("REPORT_VIEWER")
    ) {
      throw new ForbiddenException("Checklist result PDF is not available for this role");
    }
  }

  private firstItem(page: ChecklistAcknowledgementListResult | null | undefined) {
    if (Array.isArray(page?.items)) {
      return page.items[0];
    }
    if (Array.isArray(page?.data?.items)) {
      return page.data.items[0];
    }
    return undefined;
  }
}

function isValidDate(value: string | Date | null | undefined) {
  if (value === null || value === undefined) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
}
