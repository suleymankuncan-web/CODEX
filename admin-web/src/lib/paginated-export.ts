/**
 * The largest page accepted by the admin API list contracts.  Keeping export
 * reads at this bound avoids accidentally relying on a larger, undocumented
 * server page size.
 */
export const PAGINATED_EXPORT_PAGE_SIZE = 200
export const PAGINATED_EXPORT_MAX_ROWS = 10_000

export type PaginatedExportMeta = {
  count: number
  total: number
  limit: number
  offset: number
  revision?: string | null
}

export type PaginatedExportPage<T> = {
  items: T[]
  meta: PaginatedExportMeta
}

export type PaginatedExportFailure =
  | 'too_many_rows'
  | 'request_failed'
  | 'total_changed'
  | 'offset_mismatch'
  | 'invalid_meta'
  | 'empty_page'
  | 'incomplete'
  | 'invalid_key'
  | 'duplicate_key'
  | 'invalid_revision'
  | 'revision_changed'

/**
 * An intentionally technical error makes actionToast fall back to its
 * localized message instead of exposing pagination internals to operators.
 */
export class PaginatedExportError extends Error {
  readonly reason: PaginatedExportFailure

  constructor(reason: PaginatedExportFailure) {
    super('internal paginated export failure')
    this.name = 'PaginatedExportError'
    this.reason = reason
  }
}

export function isPaginatedExportError(error: unknown): error is PaginatedExportError {
  return error instanceof PaginatedExportError
}

/**
 * Fetch every page in order, retaining no partial result on any failure.
 *
 * The callback is deliberately invoked sequentially.  This keeps offsets
 * deterministic and makes a drift in total/offset/order observable before a
 * caller generates a download.
 */
export async function fetchAllPaginated<T>(
  fetchPage: (input: { limit: number; offset: number }) => Promise<PaginatedExportPage<T>>,
  options: {
    getStableKey: (item: T) => unknown
    pageSize?: number
    maxRows?: number
    requireRevision?: boolean
  },
): Promise<T[]> {
  const pageSize = options.pageSize ?? PAGINATED_EXPORT_PAGE_SIZE
  const maxRows = options.maxRows ?? PAGINATED_EXPORT_MAX_ROWS
  const requireRevision = options.requireRevision ?? false

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > PAGINATED_EXPORT_PAGE_SIZE ||
    !Number.isInteger(maxRows) ||
    maxRows < 0
  ) {
    throw new PaginatedExportError('invalid_meta')
  }

  const items: T[] = []
  const seenKeys = new Set<string>()
  let expectedOffset = 0
  let expectedTotal: number | undefined
  let expectedRevision: string | undefined

  while (true) {
    let page: PaginatedExportPage<T>
    try {
      page = await fetchPage({ limit: pageSize, offset: expectedOffset })
    } catch {
      throw new PaginatedExportError('request_failed')
    }

    const meta = page?.meta
    const pageItems = page?.items
    if (
      !Array.isArray(pageItems) ||
      !meta ||
      !Number.isInteger(meta.count) ||
      !Number.isInteger(meta.total) ||
      !Number.isInteger(meta.limit) ||
      !Number.isInteger(meta.offset) ||
      meta.count < 0 ||
      meta.total < 0 ||
      meta.limit !== pageSize ||
      meta.offset < 0 ||
      meta.count > pageSize ||
      meta.count !== pageItems.length
    ) {
      throw new PaginatedExportError('invalid_meta')
    }

    if (meta.offset !== expectedOffset) {
      throw new PaginatedExportError('offset_mismatch')
    }

    if (expectedTotal === undefined) {
      expectedTotal = meta.total
      if (expectedTotal > maxRows) {
        throw new PaginatedExportError('too_many_rows')
      }
      if (requireRevision) {
        if (!isValidRevision(meta.revision)) {
          throw new PaginatedExportError('invalid_revision')
        }
        expectedRevision = meta.revision
      }
    } else if (meta.total !== expectedTotal) {
      throw new PaginatedExportError('total_changed')
    } else if (requireRevision && meta.revision !== expectedRevision) {
      throw new PaginatedExportError('revision_changed')
    }

    if (expectedTotal === 0) {
      if (meta.count !== 0 || items.length !== 0) {
        throw new PaginatedExportError('invalid_meta')
      }
      return items
    }

    if (meta.count === 0) {
      throw new PaginatedExportError('empty_page')
    }

    items.push(...pageItems)
    for (const item of pageItems) {
      let stableKey: unknown
      try {
        stableKey = options.getStableKey(item)
      } catch {
        throw new PaginatedExportError('invalid_key')
      }

      if (typeof stableKey !== 'string' || stableKey.trim().length === 0) {
        throw new PaginatedExportError('invalid_key')
      }

      const normalizedKey = stableKey.trim()
      if (seenKeys.has(normalizedKey)) {
        throw new PaginatedExportError('duplicate_key')
      }
      seenKeys.add(normalizedKey)
    }
    if (items.length > expectedTotal) {
      throw new PaginatedExportError('invalid_meta')
    }

    if (items.length === expectedTotal) {
      return items
    }

    // A non-final short page means the server omitted rows.  Never construct a
    // partial CSV in that situation.
    if (meta.count !== pageSize) {
      throw new PaginatedExportError('incomplete')
    }

    expectedOffset += pageSize
  }
}

function isValidRevision(revision: string | null | undefined): revision is string {
  return typeof revision === 'string' && /^[0-9a-f]{64}$/.test(revision)
}
