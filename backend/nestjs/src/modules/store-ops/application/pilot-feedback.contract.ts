export const pilotFeedbackTypes = [
  "bug",
  "friction",
  "idea",
  "data_quality",
  "other",
] as const;

export type PilotFeedbackType = (typeof pilotFeedbackTypes)[number];

export const pilotFeedbackSeveritySuggestions = ["p0", "p1", "p2", "p3"] as const;

export type PilotFeedbackSeveritySuggestion =
  (typeof pilotFeedbackSeveritySuggestions)[number];

export const pilotFeedbackStatuses = ["new", "triaged", "parked", "resolved"] as const;

export type PilotFeedbackStatus = (typeof pilotFeedbackStatuses)[number];

export const pilotFeedbackClassifications = [
  "p0_stop",
  "p1_pilot_blocker",
  "p2_pilot_friction",
  "p3_backlog",
] as const;

export type PilotFeedbackClassification = (typeof pilotFeedbackClassifications)[number];

export const pilotFeedbackAuditEventTypes = {
  created: "pilot_feedback.created",
  classified: "pilot_feedback.classified",
} as const;

export type PilotFeedbackAuditEventType =
  (typeof pilotFeedbackAuditEventTypes)[keyof typeof pilotFeedbackAuditEventTypes];
