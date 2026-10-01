export interface AuthenticatedUser {
  userId: string;
  employeeId?: string;
  displayName?: string;
  username?: string;
  email?: string;
  roleCodes: string[];
  scope: AuthReadScope;
  readScope: AuthReadScope;
  actionScope: AuthActionScope;
  assignedStoreIds: string[];
  assignedStoreTypes?: string[];
  roleScopes?: Record<string, AuthReadScope>;
  permissionScopes?: Record<string, AuthReadScope>;
}

export interface AuthReadScope {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
}

export interface AuthActionScope {
  assignedStoreIds: string[];
  assignedStoreTypes?: string[];
}

export function buildAuthenticatedUser(input: {
  userId: string;
  employeeId?: string;
  displayName?: string;
  username?: string;
  email?: string;
  roleCodes: string[];
  scope?: AuthReadScope;
  readScope?: AuthReadScope;
  actionScope?: AuthActionScope;
  assignedStoreIds?: string[];
  assignedStoreTypes?: string[];
  roleScopes?: Record<string, AuthReadScope>;
  permissionScopes?: Record<string, AuthReadScope>;
}): AuthenticatedUser {
  const readScope = normalizeReadScope(input.readScope ?? input.scope);
  const assignedStoreIds = uniqueStrings(
    input.actionScope?.assignedStoreIds ?? input.assignedStoreIds ?? [],
  );
  const assignedStoreTypes = uniqueStrings(
    input.actionScope?.assignedStoreTypes ?? input.assignedStoreTypes ?? [],
  );

  return {
    userId: input.userId,
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.username ? { username: input.username } : {}),
    ...(input.email ? { email: input.email } : {}),
    roleCodes: uniqueStrings(input.roleCodes),
    scope: readScope,
    readScope,
    actionScope: {
      assignedStoreIds,
      ...(assignedStoreTypes.length > 0 ? { assignedStoreTypes } : {}),
    },
    assignedStoreIds,
    ...(assignedStoreTypes.length > 0 ? { assignedStoreTypes } : {}),
    ...(input.roleScopes
      ? { roleScopes: normalizeRoleScopes(input.roleScopes) }
      : {}),
    ...(input.permissionScopes
      ? { permissionScopes: normalizeRoleScopes(input.permissionScopes) }
      : {}),
  };
}

function normalizeReadScope(scope?: AuthReadScope): AuthReadScope {
  return {
    companyIds: uniqueStrings(scope?.companyIds ?? []),
    regionIds: uniqueStrings(scope?.regionIds ?? []),
    storeIds: uniqueStrings(scope?.storeIds ?? []),
  };
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeRoleScopes(roleScopes: Record<string, AuthReadScope>) {
  return Object.fromEntries(
    Object.entries(roleScopes).map(([roleCode, scope]) => [
      roleCode,
      normalizeReadScope(scope),
    ]),
  );
}
