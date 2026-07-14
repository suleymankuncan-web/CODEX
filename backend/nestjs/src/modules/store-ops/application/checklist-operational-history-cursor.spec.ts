import { BadRequestException } from "@nestjs/common";
import {
  decodeOperationalHistoryCursor,
  encodeOperationalHistoryCursor,
  normalizeHistoryKinds,
} from "./checklist-operational-history-cursor";

const storeId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const eventKey = "7f5d708a4ca2a9367240d65f84f86269";

describe("operational history cursor", () => {
  it("normalizes filters and round-trips a scope-bound cursor", () => {
    const kinds = normalizeHistoryKinds("task_resolved,checklist_completed,task_resolved");
    const value = encodeOperationalHistoryCursor({
      storeId,
      range: "6m",
      kinds,
      cursor: { occurredAt: "2026-07-14T10:00:00.000Z", kindRank: 4, eventKey },
    });
    expect(decodeOperationalHistoryCursor({ value, storeId, range: "6m", kinds })).toEqual({
      occurredAt: "2026-07-14T10:00:00.000Z",
      kindRank: 4,
      eventKey,
    });
    expect(Buffer.from(value, "base64url").toString("utf8")).not.toContain(sourceId);
  });

  it.each([
    { storeId: "33333333-3333-4333-8333-333333333333", range: "6m" as const },
    { storeId, range: "3m" as const },
  ])("rejects a cursor replayed outside its store or filter", (override) => {
    const kinds = normalizeHistoryKinds("checklist_completed");
    const value = encodeOperationalHistoryCursor({
      storeId,
      range: "6m",
      kinds,
      cursor: { occurredAt: "2026-07-14T10:00:00.000Z", kindRank: 1, eventKey },
    });
    expect(() => decodeOperationalHistoryCursor({ value, kinds, ...override })).toThrow(BadRequestException);
  });

  it("rejects malformed cursors and unknown kinds", () => {
    expect(() => decodeOperationalHistoryCursor({ value: "not-json", storeId, range: "all", kinds: normalizeHistoryKinds() })).toThrow(BadRequestException);
    expect(() => normalizeHistoryKinds("checklist_completed,private_note")).toThrow(BadRequestException);
  });
});
