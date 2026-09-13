/** National display format for Turkish personnel phone fields. */
export function nationalPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

export function formatPersonnelPhone(value: string) {
  const digits = nationalPhoneDigits(value)
  if (digits.length <= 3) return digits ? `(${digits}` : ''
  const rest = [digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ')
  return `(${digits.slice(0, 3)}) ${rest}`
}
