export function salesTargetIncentiveCloseLockKey(companyId: string, periodKey: string) {
  return ["sales_target_incentive_close", companyId, periodKey].join(":");
}

export function salesTargetIncentiveOwnershipLockKey(companyId: string) {
  return ["sales_target_incentive_ownership", companyId].join(":");
}
