import { HttpStatus } from "@nestjs/common";
import { createCorsAllowlistMiddleware } from "./cors-allowlist.middleware";

function createResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    response: {
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      status(statusCode: number) {
        return {
          end: jest.fn(),
          json: jest.fn(),
          statusCode,
        };
      },
    },
  };
}

describe("createCorsAllowlistMiddleware", () => {
  it("allows x-csrf-token through the explicit header allowlist", () => {
    const middleware = createCorsAllowlistMiddleware(["https://app.example.com"]);
    const { headers, response } = createResponse();

    middleware(
      {
        headers: {
          "access-control-request-headers": "authorization,x-csrf-token,x-evil",
          origin: "https://app.example.com",
        },
        method: "OPTIONS",
        originalUrl: "/api/auth/session",
      },
      response,
      jest.fn(),
    );

    expect(headers["access-control-allow-headers"]).toBe(
      "authorization,x-csrf-token",
    );
    expect(headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(headers["access-control-allow-credentials"]).toBe("true");
  });

  it("preserves explicit local mock-auth headers without reflecting arbitrary headers", () => {
    const middleware = createCorsAllowlistMiddleware(["http://localhost:5173"]);
    const { headers, response } = createResponse();

    middleware(
      {
        headers: {
          "access-control-request-headers": [
            "x-user-id",
            "x-role-codes",
            "x-company-ids",
            "x-read-store-ids",
            "x-assigned-store-ids",
            "x-evil",
          ].join(","),
          origin: "http://localhost:5173",
        },
        method: "OPTIONS",
        originalUrl: "/api/auth/session",
      },
      response,
      jest.fn(),
    );

    expect(headers["access-control-allow-headers"]).toBe(
      [
        "x-user-id",
        "x-role-codes",
        "x-company-ids",
        "x-read-store-ids",
        "x-assigned-store-ids",
      ].join(","),
    );
    expect(headers["access-control-allow-headers"]).not.toContain("x-evil");
  });

  it("rejects disallowed origins before exposing credentialed CORS headers", () => {
    const middleware = createCorsAllowlistMiddleware(["https://app.example.com"]);
    const json = jest.fn();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(() => ({
        end: jest.fn(),
        json,
      })),
    };

    middleware(
      {
        headers: { origin: "https://evil.example.com" },
        method: "GET",
        originalUrl: "/api/auth/session",
      },
      response,
      jest.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith("Vary", "Origin");
    expect(response.setHeader).not.toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      expect.any(String),
    );
  });
});
