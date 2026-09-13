import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { RegionManagerDirectoryService } from "../application/region-manager-directory.service";

@Controller("org/region-managers")
export class RegionManagerDirectoryController {
  constructor(private readonly service: RegionManagerDirectoryService) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "SUPER_ADMIN")
  list(@Req() request: { user: AuthenticatedUser }) {
    return this.service.list(request.user);
  }
}
