export function mapAuthAssignment(item: {
  user_role_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  role_code: string;
  role_name?: string;
  scope_type: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
  start_at: string;
  end_at: string | null;
  created_at: string;
}) {
  return {
    assignmentId: item.user_role_assignment_id,
    userId: item.user_id,
    ...(item.username ? { username: item.username } : {}),
    ...(item.email ? { email: item.email } : {}),
    roleCode: item.role_code,
    ...(item.role_name ? { roleName: item.role_name } : {}),
    scopeType: item.scope_type,
    companyId: item.company_id,
    regionId: item.region_id,
    storeId: item.store_id,
    effectiveFrom: item.start_at,
    effectiveTo: item.end_at,
    createdAt: item.created_at,
    active: item.end_at === null,
  };
}

export function mapAuthActionStoreAssignment(item: {
  user_action_store_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
}) {
  const now = Date.now();
  const startsAt = new Date(item.start_at).getTime();
  const endsAt =
    item.end_at === null ? Number.POSITIVE_INFINITY : new Date(item.end_at).getTime();

  return {
    assignmentId: item.user_action_store_assignment_id,
    userId: item.user_id,
    ...(item.username ? { username: item.username } : {}),
    ...(item.email ? { email: item.email } : {}),
    storeId: item.store_id,
    storeCode: item.store_code,
    storeName: item.store_name,
    companyId: item.company_id,
    regionId: item.region_id,
    regionName: item.region_name,
    effectiveFrom: item.start_at,
    effectiveTo: item.end_at,
    createdAt: item.created_at,
    active: startsAt <= now && endsAt > now,
  };
}

export function mapAuthUser(item: {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  auth_provider: string;
  provider_subject?: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
  employee_status?: string | null;
}) {
  return {
    userId: item.user_id,
    employeeId: item.employee_id,
    username: item.username,
    email: item.email,
    authProvider: item.auth_provider,
    providerSubject: item.provider_subject ?? null,
    isActive: item.is_active,
    lastLoginAt: item.last_login_at,
    createdAt: item.created_at,
    ...("deactivated_at" in item ? { deactivatedAt: item.deactivated_at ?? null } : {}),
    ...(item.deactivation_reason !== undefined
      ? { deactivationReason: item.deactivation_reason ?? null }
      : {}),
    ...(item.deactivated_by_user_id !== undefined
      ? { deactivatedByUserId: item.deactivated_by_user_id ?? null }
      : {}),
    ...(item.employee_status !== undefined ? { employeeStatus: item.employee_status ?? null } : {}),
  };
}
