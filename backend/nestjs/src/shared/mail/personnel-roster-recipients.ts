/** Explicitly requested recipients for the company-wide personnel export. Never BM/SD audiences. */
export const personnelRosterRecipients = ['crm@lufian.com.tr', 'ik@lufian.com.tr'] as const;
export function isPersonnelRosterRecipient(email:string) {
  return personnelRosterRecipients.some(recipient=>recipient===email.trim().toLowerCase());
}
