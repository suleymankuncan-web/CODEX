export function downloadCsv(input: {
  filename: string
  columns: string[]
  rows: Array<Array<string | number | null | undefined>>
}) {
  const csv = [
    input.columns.map(escapeCsvCellForDownload).join(','),
    ...input.rows.map((row) => row.map(escapeCsvCellForDownload).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = input.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r\n]/

export function escapeCsvCellForDownload(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  const safeText =
    typeof value === 'string' && CSV_FORMULA_PREFIX_PATTERN.test(text.trimStart())
      ? `'${text}`
      : text

  return `"${safeText.replaceAll('"', '""')}"`
}
