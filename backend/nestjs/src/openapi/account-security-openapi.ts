import { setJsonResponseSchema } from "./openapi-schema-helpers";

type Document = { components?: { schemas?: Record<string, unknown> }; paths: Record<string, unknown> };
const date = { type: "string", format: "date-time", nullable: true };
const object = (properties: Record<string, unknown>) => ({ type: "object", required: Object.keys(properties), properties });

export function applyAccountSecurityOpenApi(document: Document) {
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas,
    AccountSecurity: object({ passwordState: { type: "string", enum: ["unknown", "absent", "present"] },
      passwordSetAt: date, observedAt: date, lastLoginAt: date, lastActiveAt: date,
      requests: { type: "array", maxItems: 20, items: object({ requestId: { type: "string", format: "uuid" },
        kind: { type: "string", enum: ["setup", "reset"] },
        state: { type: "string", enum: ["queued", "sending", "sent", "failed", "unconfirmed", "completed", "expired"] },
        requestedAt: date, sentAt: date, expiresAt: date, completedObservedAt: date,
        verifiedPasswordSetAt: date, errorCode: { type: "string", nullable: true } }) } }),
    PasswordLinkQueued: object({ requestId: { type: "string", format: "uuid" }, state: { type: "string" } }),
  };
  setJsonResponseSchema(document.paths, "/api/auth/users/{userId}/security", "get",
    "Bounded cached account metadata and password-link history. Never contacts the provider.", "AccountSecurity");
  setJsonResponseSchema(document.paths, "/api/auth/users/{userId}/password-links", "post",
    "Queue an audited password link. Sending is distinct from verified password change.", "PasswordLinkQueued", "201");
}
