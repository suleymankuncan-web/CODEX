const individualCapabilityPermissions = new Set([
  "INCENTIVE_SALES_DIRECTOR_APPROVAL",
  "INCENTIVE_HR_APPROVAL",
  "INCENTIVE_GENERAL_MANAGER_APPROVAL",
  "INCENTIVE_PAYROLL_DELIVERY",
]);

export function isIndividualCapabilityPermission(permissionCode: string) {
  return individualCapabilityPermissions.has(permissionCode);
}
