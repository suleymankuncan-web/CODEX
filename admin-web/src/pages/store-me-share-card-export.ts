/** PNG output is explicit so native share targets receive an image file. */
export function buildPerformanceCardFile(blob: Blob, employeeName: string, periodKey: string) {
  if (blob.type !== 'image/png' || blob.size === 0) throw new Error('PNG image unavailable')
  const person = employeeName.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'personel'
  return new File([blob], `lufian-performans-karti-${person}-${periodKey.slice(0, 7) || 'donem'}.png`, { type: 'image/png' })
}

export function canSharePerformanceCard(file: File) {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export function downloadPerformanceCard(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.download = file.name
  link.href = url
  document.body.append(link)
  link.click()
  link.remove()
  // Keep the blob alive while the browser starts the file download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
