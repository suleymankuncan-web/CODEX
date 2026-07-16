export function buildBoundedManagedPersonnelPage<Row>(
  rows: Row[],
  page: { limit: number; offset: number },
) {
  return {
    items: rows.slice(page.offset, page.offset + page.limit),
    meta: { total: rows.length, limit: page.limit, offset: page.offset },
  }
}
