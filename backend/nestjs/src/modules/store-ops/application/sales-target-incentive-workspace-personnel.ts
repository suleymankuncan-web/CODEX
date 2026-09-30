import { formatMoney2 } from "./sales-target-incentive-money";
import type { SalesTargetIncentiveWorkspaceRow } from "./sales-target-incentive-workspace.contract";
import type { SalesTargetIncentiveWorkspaceRosterRow } from "../infrastructure/sales-target-incentive-workspace-read.repository";
import type { IncentiveParticipationExclusion } from "../infrastructure/sales-target-incentive-participation.repository";
import type { StorePositiveSeller } from "./store-returns.contract";

export function mergePositiveSellers(rows: SalesTargetIncentiveWorkspaceRow[], sellers: StorePositiveSeller[]) {
  for (const seller of sellers) {
    if (!seller.employee_id) continue;
    let row = rows.find(person => person.employeeId === seller.employee_id);
    if (!row) {
      row = {
        employeeId: seller.employee_id, displayName: seller.display_name ?? seller.personnel_code ?? seller.employee_id,
        participantType: "personnel", positionCode: seller.position_code ?? "UNKNOWN",
        currentEmploymentStatus: seller.current_employment_status, terminationDate: seller.termination_date,
        target: null, actual: null, dailyActualNetSales: null, trackedSaleAmount: null,
        trackedReturnAmount: null, trackedNetAmount: null, dailyAchievementPct: null,
        achievementPct: null, rate: null, calculatedAmount: null, finalAmount: null,
        signedDifferenceAmount: null, status: "blocked", correction: null, correctionRecords: [],
        participation: { included: true, reasonNote: null },
      };
      rows.push(row);
    }
    row.trackedSaleAmount = seller.sale_amount;
    row.trackedReturnAmount = seller.return_amount;
    row.trackedNetAmount = seller.net_amount;
    if (row.participantType === "personnel") {
      row.dailyActualNetSales = seller.net_amount;
      row.dailyAchievementPct = seller.net_amount !== null && row.target !== null && Number(row.target)>0
        ? (Number(seller.net_amount)/Number(row.target)*100).toFixed(2) : null;
    }
    row.activity = { coveredDays: seller.covered_days, noPositiveSales15Days: seller.no_positive_sales_15_days };
  }
}

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
