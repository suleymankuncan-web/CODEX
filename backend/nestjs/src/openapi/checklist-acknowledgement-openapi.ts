import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

const remediationStatusEnum = ["created", "duplicate", "zero_findings", "blocked"];

export const checklistAcknowledgementCommandResponseSchema: SchemaObject = {
  type: "object",
  required: ["command", "data"],
  properties: {
    command: {
      type: "object",
      required: ["status", "message"],
      properties: {
        status: { type: "string", enum: ["acknowledged"] },
        message: { type: "string" },
      },
    },
    data: {
      type: "object",
      required: ["acknowledgement", "remediation"],
      properties: {
        acknowledgement: {
          type: "object",
          required: [
            "checklistAcknowledgementId",
            "acknowledgedByUserId",
            "acknowledgementNote",
            "acknowledgedAt",
          ],
          properties: {
            checklistAcknowledgementId: { type: "string", format: "uuid" },
            acknowledgedByUserId: { type: "string" },
            acknowledgementNote: { type: "string", nullable: true },
            acknowledgedAt: { type: "string", format: "date-time" },
          },
        },
        remediation: {
          type: "object",
          required: ["status", "createdCount", "duplicateCount", "blockedCount"],
          properties: {
            status: { type: "string", enum: remediationStatusEnum },
            createdCount: { type: "integer", minimum: 0 },
            duplicateCount: { type: "integer", minimum: 0 },
            blockedCount: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },
};
