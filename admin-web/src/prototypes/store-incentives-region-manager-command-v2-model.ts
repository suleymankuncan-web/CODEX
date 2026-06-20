export type PersonnelPrototypeRow = {
  id: string
  name: string
  role: string
  target: string
  actual: string
  achievement: string
  achievementProgress: number
  rate: string
  calculated: string
  final: string
  originalFinal?: string
  correctionLabel: string
  correctionTone: 'neutral' | 'warning'
  note: string
}

export type StorePrototypeRow = {
  id: string
  name: string
  target: string
  actual: string
  achievement: string
  achievementProgress: number
  managerIncentive: string
  teamIncentive: string
  reviewed: boolean
  personnel: PersonnelPrototypeRow[]
}

export type PrototypeFinalChange = {
  hasChange: boolean
  label: string
  tone: 'neutral' | 'warning' | 'danger'
}


export const prototypeStores: StorePrototypeRow[] = [
  {
    id: 'bagdat',
    name: 'Bağdat Caddesi',
    target: '6.000.000 TL',
    actual: '6.920.000 TL',
    achievement: '%115,33',
    achievementProgress: 96,
    managerIncentive: '69.200 TL',
    teamIncentive: '84.300 TL',
    reviewed: false,
    personnel: [
      {
        id: 'mehmet',
        name: 'Mehmet Kaya',
        role: 'Mağaza müdürü',
        target: '6.000.000 TL',
        actual: '6.920.000 TL',
        achievement: '%115,33',
        achievementProgress: 100,
        rate: '0,0100',
        calculated: '69.200 TL',
        final: '69.200 TL',
        correctionLabel: 'Yok',
        correctionTone: 'neutral',
        note: '',
      },
      {
        id: 'ayse',
        name: 'Ayşe Demir',
        role: 'Müdür yardımcısı',
        target: '1.500.000 TL',
        actual: '1.780.000 TL',
        achievement: '%118,67',
        achievementProgress: 100,
        rate: '0,0165',
        calculated: '29.370 TL',
        originalFinal: '29.370 TL',
        final: '31.000 TL',
        correctionLabel: 'Düzeltildi',
        correctionTone: 'warning',
        note: 'Bölge kontrolünde satış aktarımı eşleşmesi doğrulandı.',
      },
      {
        id: 'cem',
        name: 'Cem Aksoy',
        role: 'Satış danışmanı',
        target: '1.200.000 TL',
        actual: '1.320.000 TL',
        achievement: '%110,00',
        achievementProgress: 100,
        rate: '0,0165',
        calculated: '21.780 TL',
        final: '21.780 TL',
        correctionLabel: 'Yok',
        correctionTone: 'neutral',
        note: '',
      },
    ],
  },
  {
    id: 'aqua',
    name: 'Aqua Florya',
    target: '4.800.000 TL',
    actual: '3.760.000 TL',
    achievement: '%78,33',
    achievementProgress: 65,
    managerIncentive: '0 TL',
    teamIncentive: '0 TL',
    reviewed: false,
    personnel: [
      {
        id: 'deniz',
        name: 'Deniz Yılmaz',
        role: 'Müdür yardımcısı',
        target: '1.250.000 TL',
        actual: '1.410.000 TL',
        achievement: '%112,80',
        achievementProgress: 100,
        rate: '0,0165',
        calculated: '0 TL',
        final: '0 TL',
        correctionLabel: 'Kapı bekliyor',
        correctionTone: 'warning',
        note: 'Mağaza kapısını geçmediği için prim oluşmadı.',
      },
      {
        id: 'elif',
        name: 'Elif Arslan',
        role: 'Satış danışmanı',
        target: '950.000 TL',
        actual: '1.030.000 TL',
        achievement: '%108,42',
        achievementProgress: 100,
        rate: '0,0150',
        calculated: '0 TL',
        final: '0 TL',
        correctionLabel: 'Kapı bekliyor',
        correctionTone: 'warning',
        note: 'Mağaza kapısı geçildiğinde hakediş hesaplanır.',
      },
    ],
  },
  {
    id: 'istinye',
    name: 'İstinyePark',
    target: '8.200.000 TL',
    actual: '8.640.000 TL',
    achievement: '%105,37',
    achievementProgress: 88,
    managerIncentive: '60.480 TL',
    teamIncentive: '112.760 TL',
    reviewed: false,
    personnel: [],
  },
]

export const rateTables = [
  {
    title: 'Mağaza müdürü prim oranları',
    rows: [
      ['%80,0000 - %84,9999', '0,0020'],
      ['%85,0000 - %89,9999', '0,0030'],
      ['%90,0000 - %94,9999', '0,0040'],
      ['%95,0000 - %99,9999', '0,0050'],
      ['%100,0000 - %109,9999', '0,0070'],
      ['%110,0000 ve üzeri', '0,0100'],
    ],
  },
  {
    title: 'Satış ekibi prim oranları',
    rows: [
      ['%80,0000 - %89,9999', '0,0050'],
      ['%90,0000 - %94,9999', '0,0065'],
      ['%95,0000 - %99,9999', '0,0075'],
      ['%100,0000 - %109,9999', '0,0150'],
      ['%110,0000 ve üzeri', '0,0165'],
      ['Mağaza kapısı', '%80'],
    ],
  },
]


export function toMoneyEditValue(rawValue: string) {
  return formatMoneyEditValue(removeCurrencySuffix(rawValue))
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

export function getPrototypeFinalChange(person: PersonnelPrototypeRow): PrototypeFinalChange {
  const previousAmount = parsePrototypeMoney(person.originalFinal ?? person.calculated)
  const finalAmount = parsePrototypeMoney(person.final)
  const difference = finalAmount - previousAmount

  if (Math.abs(difference) < 0.01) {
    return { hasChange: false, label: 'Yok', tone: 'neutral' }
  }

  return {
    hasChange: true,
    label: `${difference > 0 ? '+' : '-'}${formatPrototypeMoney(Math.abs(difference))}`,
    tone: difference > 0 ? 'warning' : 'danger',
  }
}

function parsePrototypeMoney(value: string) {
  const normalized = value
    .replace(/\s*TL\s*$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function formatPrototypeMoney(value: number) {
  const hasFraction = Math.abs(value % 1) >= 0.01
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFraction ? 2 : 0,
  }).format(value)

  return `${formatted} TL`
}
