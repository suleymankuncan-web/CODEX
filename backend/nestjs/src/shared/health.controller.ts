import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { Public } from "../modules/auth/decorators/public.decorator";
import { HealthService } from "./health.service";

type StatusResponse = {
  status(statusCode: number): unknown;
};

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  @Public()
  getLiveHealth() {
    return this.healthService.getLiveHealth();
  }

  @Get()
  @Public()
  async getHealth(@Res({ passthrough: true }) response: StatusResponse) {
    const result = await this.healthService.getHealth();

    if (result.status !== "ok") {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
