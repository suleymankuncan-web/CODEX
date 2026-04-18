import { createServer, Server } from "http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { JwtAuthProvider } from "./jwt-auth.provider";

describe("JwtAuthProvider", () => {
  let jwksServer: Server | null = null;

  afterEach(async () => {
    if (jwksServer) {
      await new Promise<void>((resolve, reject) => {
        jwksServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      jwksServer = null;
    }
  });

  it("verifies HS256 tokens with shared secret configuration", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
    } as never);

    const token = await new SignJWT({
      roles: ["REPORT_VIEWER"],
      company_ids: ["company-1"],
      region_ids: ["region-1"],
      store_ids: ["store-1"],
      employee_id: "employee-1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("store-ops-auth")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-1",
      employeeId: "employee-1",
      roleCodes: ["REPORT_VIEWER"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
    });
  });

  it("verifies RS256 tokens with JWKS configuration", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwksServer = createServer((request, response) => {
      if (request.url !== "/.well-known/jwks.json") {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          keys: [{ ...jwk, use: "sig", alg: "RS256", kid: "kid-1" }],
        }),
      );
    });

    const address = await new Promise<{ port: number }>((resolve, reject) => {
      jwksServer?.listen(0, "127.0.0.1", () => {
        const serverAddress = jwksServer?.address();
        if (!serverAddress || typeof serverAddress === "string") {
          reject(new Error("failed to bind JWKS server"));
          return;
        }

        resolve({ port: serverAddress.port });
      });
    });

    const provider = new JwtAuthProvider({
      jwtSecret: "unused-secret",
      jwtIssuer: "https://issuer.example.com",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
    } as never);

    const token = await new SignJWT({
      roles: ["SNAPSHOT_OPERATOR"],
      company_ids: "company-2,company-3",
    })
      .setProtectedHeader({ alg: "RS256", kid: "kid-1" })
      .setSubject("user-2")
      .setIssuer("https://issuer.example.com")
      .setAudience("store-ops-api")
      .sign(privateKey);

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-2",
      employeeId: undefined,
      roleCodes: ["SNAPSHOT_OPERATOR"],
      scope: {
        companyIds: ["company-2", "company-3"],
        regionIds: [],
        storeIds: [],
      },
    });
  });

  it("rejects JWT tokens with invalid issuer", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
    } as never);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("another-issuer")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    await expect(
      provider.resolveUser({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).rejects.toThrow("Invalid JWT");
  });
});
