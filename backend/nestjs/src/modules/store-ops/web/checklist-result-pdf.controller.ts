import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistResultPdfService } from "../application/checklist-result-pdf.service";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";

type HeaderResponse = {
  setHeader(name: string, value: string): unknown;
};

@Controller("checklists")
@ApiTags("Checklist")
export class ChecklistResultPdfController {
  constructor(private readonly checklistResultPdfService: ChecklistResultPdfService) {}

  @Get("instances/:checklistInstanceId/result.pdf")
  @ApiOperation({
    operationId: "ChecklistController_downloadChecklistResultPdf",
    summary: "Download completed checklist result as PDF",
  })
  @ApiParam({
    name: "checklistInstanceId",
    schema: { type: "string", format: "uuid" },
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({ schema: { type: "string", format: "binary" } })
  @ApiBadRequestResponse({ description: "The checklist instance identifier is malformed." })
  @ApiUnauthorizedResponse({ description: "Authentication is required." })
  @ApiForbiddenResponse({ description: "The authenticated role cannot export result PDFs." })
  @ApiNotFoundResponse({
    description: "The completed checklist result is unavailable or outside the caller scope.",
  })
  @ApiUnprocessableEntityResponse({
    description: "The checklist result exceeds the bounded PDF export limits.",
  })
  @ApiInternalServerErrorResponse({ description: "The PDF could not be rendered." })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "REPORT_VIEWER")
  async downloadChecklistResultPdf(
    @Req() request: { user: AuthenticatedUser },
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    const document = await this.checklistResultPdfService.exportChecklistResultPdf({
      checklistInstanceId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      ...(actorReadScope ? { actorReadScope } : {}),
    });
    const contentDisposition =
      `attachment; filename="${document.fileName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`;

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", contentDisposition);
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
    response.setHeader("Vary", "Authorization, Cookie");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Length", String(document.buffer.length));

    return new StreamableFile(document.buffer, {
      type: "application/pdf",
      disposition: contentDisposition,
      length: document.buffer.length,
    });
  }
}
