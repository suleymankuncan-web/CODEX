export function downloadCsv(input: {
  filename: string
  columns: string[]
  rows: Array<Array<string | number | null | undefined>>
}) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }

  const csv = [
    input.columns.map(escapeCell).join(','),
    ...input.rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = input.filename
  anchor.click()
  URL.revokeObjectURL(url)
}
