import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { PilotFeedbackService } from "../application/pilot-feedback.service";
import { ClassifyPilotFeedbackDto } from "./dto/classify-pilot-feedback.dto";
import { CreatePilotFeedbackDto } from "./dto/create-pilot-feedback.dto";
import { ListPilotFeedbackQueryDto } from "./dto/list-pilot-feedback.query";

type PilotFeedbackRequest = {
  user: {
    userId: string;
    roleCodes: string[];
  };
};

@Controller()
export class PilotFeedbackController {
  constructor(private readonly pilotFeedbackService: PilotFeedbackService) {}

  @Post("pilot-feedback")
  @RequireScope("authenticated")
  async createFeedback(@Req() request: PilotFeedbackRequest, @Body() body: CreatePilotFeedbackDto) {
    return this.pilotFeedbackService.createFeedback({
      actorUserId: request.user.userId,
      actorRoles: request.user.roleCodes,
      ...body,
    });
  }

  @Get("admin/pilot-feedback")
  @RequireRoles("SUPER_ADMIN")
  @RequireScope("authenticated")
  async listFeedback(@Query() query: ListPilotFeedbackQueryDto) {
    return this.pilotFeedbackService.listFeedback({
      status: query.status,
      classification: query.classification,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch("admin/pilot-feedback/:feedbackId/classification")
  @RequireRoles("SUPER_ADMIN")
  @RequireScope("authenticated")
  async classifyFeedback(
    @Req() request: PilotFeedbackRequest,
    @Param("feedbackId") feedbackId: string,
    @Body() body: ClassifyPilotFeedbackDto,
  ) {
    return this.pilotFeedbackService.classifyFeedback({
      actorUserId: request.user.userId,
      actorRoles: request.user.roleCodes,
      feedbackId,
      classification: body.classification,
      note: body.note,
    });
  }
}
