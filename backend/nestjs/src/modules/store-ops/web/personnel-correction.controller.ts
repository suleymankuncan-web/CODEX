import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope, RequireScope } from "../../auth/decorators/scope.decorator";
import { PersonnelCorrectionRepository } from "../infrastructure/personnel-correction.repository";
import { CreatePersonnelCorrectionDto, ReviewPersonnelCorrectionDto } from "./dto/personnel-correction.dto";
import { ListOffboardingRequestsQueryDto } from "./dto/list-offboarding-requests.query";

@Controller("workforce/personnel-corrections")
@RequireScope("authenticated")
export class PersonnelCorrectionController {
  constructor(private readonly repository: PersonnelCorrectionRepository) {}

  @Get()
  @RequireRoles("STORE_MANAGER", "HR_ADMIN", "SUPER_ADMIN")
  list(@Req() request: { user: AuthenticatedUser }, @Query() query: ListOffboardingRequestsQueryDto) {
    return this.repository.list(request.user, query);
  }

  @Get("personnel/:employeeId/stores/:storeId")
  @RequireRoles("STORE_MANAGER")
  @RequireActionScope("store")
  getPersonnel(@Req() request: { user: AuthenticatedUser },
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Param("storeId", ParseUUIDPipe) storeId: string) {
    return this.repository.getPersonnel(request.user, employeeId, storeId);
  }

  @Post()
  @RequireRoles("STORE_MANAGER")
  @RequireActionScope("store")
  submit(@Req() request: { user: AuthenticatedUser }, @Body() body: CreatePersonnelCorrectionDto) {
    return this.repository.submit(request.user, body);
  }

  @Patch(":requestId/review")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  review(@Req() request: { user: AuthenticatedUser },
    @Param("requestId", ParseUUIDPipe) requestId: string, @Body() body: ReviewPersonnelCorrectionDto) {
    return this.repository.review(request.user, requestId, body);
  }
}
