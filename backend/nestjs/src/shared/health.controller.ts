import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { Public } from "../modules/auth/decorators/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  async getHealth() {
    const result = await this.healthService.getHealth();

    if (result.status !== "ok") {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
