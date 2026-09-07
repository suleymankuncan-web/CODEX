import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { PersonnelObservationService } from "../application/personnel-observation.service";
import { ListPersonnelObservationsQueryDto } from "./dto/list-personnel-observations.query";
import { personnelObservationResponseSchema } from "./personnel-observation-response.schema";

@Controller("integrations")
export class IntegrationPersonnelObservationsController {
  constructor(private readonly observations: PersonnelObservationService) {}

  @Get("personnel-observations")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  @ApiOkResponse({ schema: personnelObservationResponseSchema })
  async list(
    @Query() query: ListPersonnelObservationsQueryDto,
    @Req() request: { user: { scope: { companyIds: string[] } } },
  ) {
    return this.observations.list({
      actorCompanyIds: request.user.scope.companyIds,
      fromDate: query.fromDate,
      toDate: query.toDate,
      storeId: query.storeId,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
