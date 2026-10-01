/** A direct store assignment cannot borrow a manager role from a different scope. */
export function incentiveManagerRoleScopeSql(store: "store" | "s", role: "ura" | "role_assignment" = "ura") {
  return `(${role}.scope_type='global' OR (${role}.scope_type='company' AND ${role}.company_id=${store}.company_id)
    OR (${role}.scope_type='region' AND ${role}.region_id=${store}.region_id) OR (${role}.scope_type='store' AND ${role}.store_id=${store}.store_id))`;
}
