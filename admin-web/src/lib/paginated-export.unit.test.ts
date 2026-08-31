import { describe, expect, it } from 'vitest'
import { fetchAllPaginated, type PaginatedExportPage } from './paginated-export'

function page<T>(
  items: T[],
  total: number,
  offset: number,
  limit = 200,
  revision?: string | null,
): PaginatedExportPage<T> {
  return {
    items,
    meta: {
      count: items.length,
      total,
      limit,
      offset,
      ...(revision === undefined ? {} : { revision }),
    },
  }
}

describe('paginated CSV export collection', () => {
  it('accepts exactly 10,000 rows and requests deterministic sequential offsets', async () => {
    const offsets: number[] = []
    const result = await fetchAllPaginated(async ({ limit, offset }) => {
      offsets.push(offset)
      const remaining = 10_000 - offset
      const count = Math.min(limit, remaining)
      return page(Array.from({ length: count }, (_, index) => offset + index), 10_000, offset, limit)
    }, { getStableKey: (item) => String(item) })

    expect(result).toHaveLength(10_000)
    expect(offsets).toHaveLength(50)
    expect(offsets.slice(0, 3)).toEqual([0, 200, 400])
    expect(offsets.at(-1)).toBe(9_800)
  })

  it('rejects 10,001 rows before requesting another page', async () => {
    let calls = 0

    await expect(
      fetchAllPaginated(async ({ limit, offset }) => {
        calls += 1
        return page(Array.from({ length: limit }, () => offset), 10_001, offset, limit)
      }, { getStableKey: (item) => String(item) }),
    ).rejects.toMatchObject({ reason: 'too_many_rows' })

    expect(calls).toBe(1)
  })

  it('rejects a total drift in the middle of a sequential export', async () => {
    await expect(
      fetchAllPaginated(async ({ limit, offset }) =>
        offset === 0 ? page([1, 2], 3, offset, limit) : page([3], 4, offset, limit),
        { pageSize: 2, getStableKey: (item) => String(item) },
      ),
    ).rejects.toMatchObject({ reason: 'total_changed' })
  })

  it('rejects an empty intermediate page and any request failure', async () => {
    await expect(
      fetchAllPaginated(async ({ limit, offset }) =>
        offset === 0
          ? page(Array.from({ length: limit }, (_, index) => offset + index), 400, offset, limit)
          : page([], 400, offset, limit),
        { pageSize: 200, getStableKey: (item) => String(item) },
      ),
    ).rejects.toMatchObject({ reason: 'empty_page' })

    await expect(
      fetchAllPaginated(async ({ limit, offset }) => {
        if (offset === 0) {
          return page(Array.from({ length: limit }, (_, index) => offset + index), 400, offset, limit)
        }
        throw new Error('request failed')
      }, { pageSize: 200, getStableKey: (item) => String(item) }),
    ).rejects.toMatchObject({ reason: 'request_failed' })
  })

  it('rejects an unexpected page offset or a short non-final page', async () => {
    await expect(
      fetchAllPaginated(async ({ limit, offset }) =>
        offset === 0
          ? page(Array.from({ length: limit }, () => 1), 400, offset + 1, limit)
          : page([], 400, offset, limit),
        { pageSize: 200, getStableKey: (item) => String(item) },
      ),
    ).rejects.toMatchObject({ reason: 'offset_mismatch' })

    await expect(
      fetchAllPaginated(async ({ limit, offset }) =>
        offset === 0 ? page([1], 400, offset, limit) : page([], 400, offset, limit),
        { pageSize: 2, getStableKey: (item) => String(item) },
      ),
    ).rejects.toMatchObject({ reason: 'incomplete' })
  })

  it('rejects duplicate stable keys across pages even when counts stay constant', async () => {
    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) =>
          offset === 0 ? page(['A', 'B'], 4, offset, limit) : page(['B', 'D'], 4, offset, limit),
        { pageSize: 2, getStableKey: (item) => item },
      ),
    ).rejects.toMatchObject({ reason: 'duplicate_key' })
  })

  it('rejects a same-total row substitution when a mutable revision drifts', async () => {
    const revisionA = 'a'.repeat(64)
    const revisionB = 'b'.repeat(64)

    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) =>
          offset === 0
            ? page(['A', 'B'], 4, offset, limit, revisionA)
            : page(['C', 'D'], 4, offset, limit, revisionB),
        { pageSize: 2, requireRevision: true, getStableKey: (item) => item },
      ),
    ).rejects.toMatchObject({ reason: 'revision_changed' })
  })

  it('requires a lowercase 64-hex revision on every mutable page', async () => {
    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page(['A'], 1, offset, limit),
        { requireRevision: true, getStableKey: (item) => item },
      ),
    ).rejects.toMatchObject({ reason: 'invalid_revision' })

    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page(['A'], 1, offset, limit, 'A'.repeat(64)),
        { requireRevision: true, getStableKey: (item) => item },
      ),
    ).rejects.toMatchObject({ reason: 'invalid_revision' })
  })

  it('accepts an exact revision for empty pages and rejects a non-empty out-of-range page', async () => {
    const revision = 'c'.repeat(64)
    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) =>
          offset === 0
            ? page(['A', 'B'], 3, offset, limit, revision)
            : page(['C'], 3, offset, limit, revision),
        { pageSize: 2, requireRevision: true, getStableKey: (item) => item },
      ),
    ).resolves.toEqual(['A', 'B', 'C'])

    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page([], 0, offset, limit, revision),
        { requireRevision: true, getStableKey: (item) => item },
      ),
    ).resolves.toEqual([])

    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page([], 1, offset, limit, revision),
        { requireRevision: true, getStableKey: (item) => item },
      ),
    ).rejects.toMatchObject({ reason: 'empty_page' })
  })

  it('rejects blank, non-string, and duplicate stable keys', async () => {
    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page([1], 1, offset, limit),
        { getStableKey: () => '  ' },
      ),
    ).rejects.toMatchObject({ reason: 'invalid_key' })

    await expect(
      fetchAllPaginated(
        async ({ limit, offset }) => page([1], 1, offset, limit),
        { getStableKey: () => 1 },
      ),
    ).rejects.toMatchObject({ reason: 'invalid_key' })
  })
})
