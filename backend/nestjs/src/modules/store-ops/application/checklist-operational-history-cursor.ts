import { BadRequestException } from "@nestjs/common";
import {
  checklistOperationalHistoryKinds,
  type ChecklistOperationalHistoryKind,
  type ChecklistOperationalHistoryRange,
} from "./checklist-operational-history.contract";

export type ChecklistOperationalHistoryCursor = {
  occurredAt: string;
  kindRank: number;
  eventKey: string;
};

type CursorEnvelope = ChecklistOperationalHistoryCursor & {
  v: 1;
  storeId: string;
  range: ChecklistOperationalHistoryRange;
  kinds: ChecklistOperationalHistoryKind[];
};

const EVENT_KEY = /^[0-9a-f]{32}$/;

export function normalizeHistoryKinds(input?: string) {
  if (!input?.trim()) return [...checklistOperationalHistoryKinds];
  const values = [...new Set(input.split(",").map((value) => value.trim()).filter(Boolean))].sort();
  if (values.length === 0 || values.some((value) => !checklistOperationalHistoryKinds.includes(value as ChecklistOperationalHistoryKind))) {
    throw new BadRequestException("Operational history kinds are invalid");
  }
  return values as ChecklistOperationalHistoryKind[];
}
export function encodeOperationalHistoryCursor(input: {
  storeId: string;
  range: ChecklistOperationalHistoryRange;
  kinds: ChecklistOperationalHistoryKind[];
  cursor: ChecklistOperationalHistoryCursor;
}) {
  const envelope: CursorEnvelope = {
    v: 1,
    storeId: input.storeId,
    range: input.range,
    kinds: [...input.kinds].sort(),
    ...input.cursor,
  };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function decodeOperationalHistoryCursor(input: {
  value?: string;
  storeId: string;
  range: ChecklistOperationalHistoryRange;
  kinds: ChecklistOperationalHistoryKind[];
}): ChecklistOperationalHistoryCursor | null {
  if (!input.value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(input.value, "base64url").toString("utf8")) as Partial<CursorEnvelope>;
    const kinds = [...input.kinds].sort();
    const valid = parsed.v === 1
      && parsed.storeId === input.storeId
      && parsed.range === input.range
      && Array.isArray(parsed.kinds)
      && JSON.stringify([...parsed.kinds].sort()) === JSON.stringify(kinds)
      && typeof parsed.occurredAt === "string"
      && !Number.isNaN(Date.parse(parsed.occurredAt))
      && Number.isInteger(parsed.kindRank)
      && (parsed.kindRank ?? 0) >= 1
      && (parsed.kindRank ?? 0) <= checklistOperationalHistoryKinds.length
      && typeof parsed.eventKey === "string"
      && EVENT_KEY.test(parsed.eventKey);
    if (!valid) throw new Error("invalid cursor");
    return {
      occurredAt: new Date(parsed.occurredAt!).toISOString(),
      kindRank: parsed.kindRank!,
      eventKey: parsed.eventKey!,
    };
  } catch {
    throw new BadRequestException("Operational history cursor is invalid");
  }
}
