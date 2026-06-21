export function normalizeMoneyInput(value: string) {
  const normalized = normalizeLocalizedMoneyText(value)
  if (!normalized) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed.toFixed(2)
}

export function toMoneyEditValue(rawValue: string) {
  return formatMoneyEditValue(removeCurrencySuffix(rawValue))
}

export function toMoneyInputBuffer(rawValue: string) {
  const parsed = parseMoneyInput(rawValue)
  if (parsed.invalid) return removeCurrencySuffix(rawValue)
  if (!parsed.integer && parsed.fraction === undefined) return ''

  const integer = parsed.integer || '0'
  if (parsed.fraction !== undefined) {
    return `${integer},${parsed.fraction}`
  }

  return integer
}

export function formatMoneyEditValue(rawValue: string) {
  const parsed = parseMoneyInput(rawValue)
  if (parsed.invalid) return removeCurrencySuffix(rawValue)

  const groupedInteger = groupMoneyInteger(parsed.integer)
  if (parsed.fraction !== undefined) {
    return `${groupedInteger || '0'},${parsed.fraction}`
  }

  return groupedInteger
}

export function formatMoneyDisplayValue(rawValue: string) {
  const parsed = parseMoneyInput(rawValue)
  if (parsed.invalid) return removeCurrencySuffix(rawValue)
  if (!parsed.integer && parsed.fraction === undefined) return ''

  const normalizedInteger = groupMoneyInteger(parsed.integer) || '0'
  const normalizedFraction = (parsed.fraction ?? '').padEnd(2, '0').slice(0, 2)

  return `${normalizedInteger},${normalizedFraction} TL`
}

function removeCurrencySuffix(rawValue: string) {
  return rawValue.replace(/\s*TL\s*$/i, '').trim()
}

function parseMoneyInput(rawValue: string): { integer: string; fraction?: string; invalid: boolean } {
  const compact = removeCurrencySuffix(rawValue).replace(/\s+/g, '')
  if (!compact) return { integer: '', invalid: false }
  if (/[^0-9.,]/.test(compact)) return { integer: compact, invalid: true }

  const lastDot = compact.lastIndexOf('.')
  const lastComma = compact.lastIndexOf(',')

  if (lastDot === -1 && lastComma === -1) {
    return { integer: compact.replace(/^0+(?=\d)/, ''), invalid: false }
  }

  if (lastComma === -1 && /^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    return { integer: compact.replace(/\./g, '').replace(/^0+(?=\d)/, ''), invalid: false }
  }

  const decimalSeparator = lastDot > lastComma ? '.' : ','
  const groupingSeparator = decimalSeparator === '.' ? ',' : '.'
  const separatorIndex = decimalSeparator === '.' ? lastDot : lastComma
  const integerPart = compact.slice(0, separatorIndex)
  const fractionPart = compact.slice(separatorIndex + 1)

  if (fractionPart.length > 2) return { integer: compact, invalid: true }
  if (!/^\d*$/.test(fractionPart)) return { integer: compact, invalid: true }
  if (integerPart.includes(decimalSeparator)) return { integer: compact, invalid: true }
  if (integerPart.includes(groupingSeparator)) {
    const groupingPattern = new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})*$`)
    if (!groupingPattern.test(integerPart)) return { integer: compact, invalid: true }
  }

  const integerDigits = integerPart.replaceAll(groupingSeparator, '')
  if (!/^\d*$/.test(integerDigits)) return { integer: compact, invalid: true }

  return {
    integer: integerDigits.replace(/^0+(?=\d)/, ''),
    fraction: fractionPart,
    invalid: false,
  }
}

function groupMoneyInteger(integer: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function normalizeLocalizedMoneyText(value: string) {
  const compact = value.trim().replace(/\s+/g, '').replace(/\s*TL\s*$/i, '')
  if (!compact) return ''

  const lastDot = compact.lastIndexOf('.')
  const lastComma = compact.lastIndexOf(',')

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ','
    const groupingSeparator = decimalSeparator === '.' ? ',' : '.'
    return compact.split(groupingSeparator).join('').replace(decimalSeparator, '.')
  }

  if (lastComma >= 0) {
    return compact.replace(/\./g, '').replace(',', '.')
  }

  if (lastDot >= 0) {
    if (/^-?\d{1,3}(?:\.\d{3})+$/.test(compact)) {
      return compact.replace(/\./g, '')
    }

    return compact
  }

  return compact
}
