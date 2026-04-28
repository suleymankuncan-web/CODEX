import { Body, Controller, Get, INestApplication, Module, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IsString } from "class-validator";
import * as request from "supertest";
import { AppConfigService } from "../../src/shared/app-config.service";
import { configureHttpSecurity } from "../../src/shared/http/configure-http-security";

class SecurityValidationDto {
  @IsString()
  name!: string;
}

@Controller("security-test")
class SecurityTestController {
  @Get("ok")
  ok() {
    return { ok: true };
  }

  @Post("validation")
  validation(@Body() body: SecurityValidationDto) {
    return body;
  }

  @Get("boom")
  boom() {
    throw new Error("secret stack should not leak");
  }
}

@Module({
  controllers: [SecurityTestController],
})
class SecurityTestModule {}

async function createSecurityApp(config: {
  corsAllowedOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [SecurityTestModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  configureHttpSecurity(app, config as AppConfigService);
  await app.init();

  return app;
}

describe("Production Security Gate V1-A", () => {
  it("allows configured CORS origins", async () => {
    const app = await createSecurityApp({
      corsAllowedOrigins: ["http://localhost:5173"],
      rateLimitMax: 100,
      rateLimitWindowMs: 60000,
    });

    try {
      const response = await request(app.getHttpServer())
        .options("/api/security-test/ok")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:5173",
      );
    } finally {
      await app.close();
    }
  });

  it("rejects disallowed CORS origins", async () => {
    const app = await createSecurityApp({
      corsAllowedOrigins: ["http://localhost:5173"],
      rateLimitMax: 100,
      rateLimitWindowMs: 60000,
    });

    try {
      const response = await request(app.getHttpServer())
        .get("/api/security-test/ok")
        .set("Origin", "https://evil.example.com")
        .set("x-correlation-id", "corr-cors");

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        correlationId: "corr-cors",
        errorCode: "CORS_ORIGIN_DENIED",
        message: "CORS origin is not allowed",
        path: "/api/security-test/ok",
        statusCode: 403,
      });
      expect(response.body.stack).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("returns a standard 429 response when rate limit is exceeded", async () => {
    const app = await createSecurityApp({
      corsAllowedOrigins: ["http://localhost:5173"],
      rateLimitMax: 2,
      rateLimitWindowMs: 60000,
    });

    try {
      await request(app.getHttpServer()).get("/api/security-test/ok").expect(200);
      await request(app.getHttpServer()).get("/api/security-test/ok").expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/security-test/ok")
        .set("x-correlation-id", "corr-rate-limit");

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        correlationId: "corr-rate-limit",
        errorCode: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded",
        path: "/api/security-test/ok",
        statusCode: 429,
      });
      expect(response.body.stack).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("returns validation errors in the standard error response shape", async () => {
    const app = await createSecurityApp({
      corsAllowedOrigins: ["http://localhost:5173"],
      rateLimitMax: 100,
      rateLimitWindowMs: 60000,
    });

    try {
      const response = await request(app.getHttpServer())
        .post("/api/security-test/validation")
        .set("x-correlation-id", "corr-validation")
        .send({ extra: "not allowed" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        correlationId: "corr-validation",
        errorCode: "VALIDATION_ERROR",
        path: "/api/security-test/validation",
        statusCode: 400,
      });
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(typeof response.body.timestamp).toBe("string");
      expect(response.body.stack).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("does not leak stack traces for unexpected errors", async () => {
    const app = await createSecurityApp({
      corsAllowedOrigins: ["http://localhost:5173"],
      rateLimitMax: 100,
      rateLimitWindowMs: 60000,
    });

    try {
      const response = await request(app.getHttpServer())
        .get("/api/security-test/boom")
        .set("x-correlation-id", "corr-boom");

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        correlationId: "corr-boom",
        errorCode: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        path: "/api/security-test/boom",
        statusCode: 500,
      });
      expect(response.body.stack).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain("secret stack should not leak");
    } finally {
      await app.close();
    }
  });
});
