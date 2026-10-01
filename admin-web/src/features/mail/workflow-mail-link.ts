export function reportPeriodFromMail(search: string, currentPeriod: string) {
  const values = new URLSearchParams(search).getAll('period')
  const period = values[0]
  return values.length === 1 && period !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period <= currentPeriod
    ? period : currentPeriod
}
export function inboxTabFromMail(search: string, workforceAllowed: boolean) {
  const values = new URLSearchParams(search).getAll('tab')
  const tab = values[0]
  return workforceAllowed && values.length === 1 && (tab === 'seller-code' || tab === 'offboarding') ? tab : 'workflow'
}
