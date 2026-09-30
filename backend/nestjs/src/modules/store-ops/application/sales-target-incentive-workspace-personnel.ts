import { formatMoney2 } from "./sales-target-incentive-money";
import type { SalesTargetIncentiveWorkspaceRow } from "./sales-target-incentive-workspace.contract";
import type { SalesTargetIncentiveWorkspaceRosterRow } from "../infrastructure/sales-target-incentive-workspace-read.repository";
import type { IncentiveParticipationExclusion } from "../infrastructure/sales-target-incentive-participation.repository";

export function mergeWorkspacePersonnel(rows: SalesTargetIncentiveWorkspaceRow[], roster: SalesTargetIncentiveWorkspaceRosterRow[], exclusions: IncentiveParticipationExclusion[]) {
  const represented = new Set(rows.map((row) => row.employeeId));
  const people = [
    ...roster.map((person) => ({ employeeId: person.employee_id, displayName: person.display_name, positionCode: person.position_code,
      currentEmploymentStatus: person.current_employment_status, terminationDate: person.termination_date, target: person.target_amount })),
    ...exclusions.map((person) => ({ employeeId: person.employeeId, displayName: person.displayName, positionCode: person.positionCode, currentEmploymentStatus: null, terminationDate: null, target: null })),
  ];
  for (const person of people) {
    if (represented.has(person.employeeId)) continue;
    rows.push({ ...person, participantType: person.positionCode === "STORE_MANAGER" ? "store_manager" : "personnel",
      actual: null, dailyActualNetSales: null, trackedSaleAmount: null, trackedReturnAmount: null, trackedNetAmount: null, dailyAchievementPct: null,
      achievementPct: null, rate: null, calculatedAmount: null, finalAmount: null, signedDifferenceAmount: null, status: "blocked", correction: null, correctionRecords: [] });
    represented.add(person.employeeId);
  }
  for (const row of rows) {
    const excluded = exclusions.find((item) => item.employeeId === row.employeeId);
    row.participation = { included: !excluded, reasonNote: excluded?.reasonNote ?? null };
    if (!excluded) continue;
    // Policy changes the contribution, never the raw calculation or correction baseline.
    row.finalAmount = "0.00";
    const calculated = row.calculatedAmount === null ? null : formatMoney2(row.calculatedAmount);
    row.signedDifferenceAmount = calculated === null ? null : calculated === "0.00" ? "0.00" : calculated.startsWith("-") ? calculated.slice(1) : `-${calculated}`;
  }
}
