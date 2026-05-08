import { Controller, Get, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { WorkflowInboxService } from "../application/workflow-inbox.service";

@Controller("workflow")
export class WorkflowInboxController {
  constructor(private readonly workflowInboxService: WorkflowInboxService) {}

  @Get("inbox")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER")
  async listInbox(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
      };
    },
  ) {
    return this.workflowInboxService.listInbox({
      actorRoles: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
  }
}
