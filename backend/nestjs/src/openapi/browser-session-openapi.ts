import {
  type MutablePathItem,
  setJsonResponseSchema,
} from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

export function applyBrowserSessionOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    BrowserSessionCreateResponse: {
      type: "object",
      required: ["csrfToken", "expiresAt", "sessionId", "session"],
      properties: {
        csrfToken: { type: "string" },
        expiresAt: { type: "string", format: "date-time" },
        sessionId: { type: "string" },
        session: { $ref: "#/components/schemas/AuthSessionResponse" },
      },
    },
    BrowserSessionClearResponse: {
      type: "object",
      required: ["cleared"],
      properties: {
        cleared: { type: "boolean" },
      },
    },
  };

  const bootstrap = document.components.schemas.AuthBootstrapResponse as {
    properties?: { provider?: { properties?: Record<string, unknown> } };
  } | undefined;
  if (bootstrap?.properties?.provider?.properties) {
    bootstrap.properties.provider.properties.managedBrowserSession = { type: "boolean" };
  }
  setJsonResponseSchema(document.paths, "/api/auth/browser-session/oidc", "post",
    "Server-side PKCE session establishment. Provider credentials are never returned.", "BrowserSessionCreateResponse", "200");
  const oidc = (document.paths["/api/auth/browser-session/oidc"] as MutablePathItem | undefined)?.post;
  if (oidc) oidc.security = [];

  setJsonResponseSchema(
    document.paths,
    "/api/auth/browser-session",
    "post",
    "Browser session cookie bootstrap response with CSRF nonce.",
    "BrowserSessionCreateResponse",
    "201",
  );
  setJsonResponseSchema(
    document.paths,
    "/api/auth/browser-session",
    "delete",
    "Browser session cookie clear response.",
    "BrowserSessionClearResponse",
  );

  const clearOperation = (
    document.paths["/api/auth/browser-session"] as MutablePathItem | undefined
  )?.delete;
  if (clearOperation) {
    clearOperation.security = [];
  }
}
