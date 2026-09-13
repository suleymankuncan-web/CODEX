import {
  REQUEST_CENTER_SLA_POLICY,
  resolveRequestCenterTiming,
} from "./request-center-sla-policy";

describe("request center owner-approved SLA policy", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("locks the approved Europe/Istanbul calendar-day matrix", () => {
    expect(REQUEST_CENTER_SLA_POLICY).toEqual({
      timezone: "Europe/Istanbul",
      targetPendingRegionDays: 2,
      workforcePendingHrDays: 3,
      workforceReturnedStoreDays: 2,
      resubmissionResetsClock: true,
      terminalStopsClock: true,
    });
  });

  it.each([
    ["target", "pending_region_approval", "2026-07-13T12:00:00.000Z", "region", "2026-07-15T12:00:00.000Z", true],
    ["sellerCode", "pending_hr_approval", "2026-07-14T12:00:00.000Z", "hr", "2026-07-17T12:00:00.000Z", false],
    ["offboarding", "rejected", "2026-07-13T12:00:00.000Z", "store", "2026-07-15T12:00:00.000Z", true],
  ] as const)("maps %s/%s to an authoritative owner and due result", (requestType, status, waitingSince, nextOwner, dueAt, isOverdue) => {
    expect(resolveRequestCenterTiming({ requestType, status, waitingSince, now })).toEqual({
      waitingSince,
      nextOwner,
      dueAt,
      isOverdue,
    });
  });

  it("closes the clock for terminal requests and preserves unknown waiting truth", () => {
    expect(resolveRequestCenterTiming({ requestType: "sellerCode", status: "approved", waitingSince: "2026-07-10T09:00:00.000Z", now })).toEqual({ waitingSince: null, nextOwner: null, dueAt: null, isOverdue: false });
    expect(resolveRequestCenterTiming({ requestType: "sellerCode", status: "pending_hr_approval", waitingSince: null, now })).toEqual({ waitingSince: null, nextOwner: "hr", dueAt: null, isOverdue: null });
  });

  it("does not apply the workforce returned SLA to rejected target requests", () => {
    expect(resolveRequestCenterTiming({
      requestType: "target",
      status: "rejected",
      waitingSince: "2026-07-13T12:00:00.000Z",
      now,
    })).toEqual({
      waitingSince: "2026-07-13T12:00:00.000Z",
      nextOwner: null,
      dueAt: null,
      isOverdue: null,
    });
  });
});
it('stops the waiting clock for rejected personnel corrections', () => {
  expect(resolveRequestCenterTiming({ requestType: 'personnelCorrection', status: 'rejected', waitingSince: '2026-07-01T00:00:00.000Z' })).toEqual({ waitingSince: null, nextOwner: null, dueAt: null, isOverdue: false });
});
