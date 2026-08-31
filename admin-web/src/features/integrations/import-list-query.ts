export type NeedsActionListInput = {
  limit?: number
  offset?: number
  entityType?: string
  status?: string
  sourceCode?: string
  q?: string
}

export type ListPageInput = {
  limit?: number
  offset?: number
}

const needsActionSearchMaxLength = 128

export function buildNeedsActionQuery(input: NeedsActionListInput = {}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 12),
    offset: String(input?.offset ?? 0),
  })

  if (input?.entityType) {
    params.set('entityType', input.entityType)
  }
  if (input?.status) {
    params.set('status', input.status)
  }
  if (input?.sourceCode) {
    params.set('sourceCode', input.sourceCode)
  }

  const search = input.q?.trim().slice(0, needsActionSearchMaxLength)
  if (search) {
    params.set('q', search)
  }

  return params
}

export function buildNeedsActionQueryKey(input: NeedsActionListInput = {}) {
  const key: Array<string | number> = [
    'integration-needs-action',
    input.offset ?? 0,
    input.entityType ?? '',
    input.status ?? '',
  ]
  const search = input.q?.trim().slice(0, needsActionSearchMaxLength)
  const sourceCode = input.sourceCode ?? ''

  // Keep the historical key shape for the unfiltered/default request. Once
  // either optional filter is present, use fixed, labelled slots so q and
  // sourceCode can never produce the same cache identity.
  if (search || sourceCode) {
    key.push('q', search ?? '', 'sourceCode', sourceCode)
  }
  if (input.limit !== undefined && input.limit !== 12) {
    key.push('limit', input.limit)
  }

  return key
}

export function buildListPageQuery(input: ListPageInput = {}, fallbackLimit = 20) {
  return new URLSearchParams({
    limit: String(input.limit ?? fallbackLimit),
    offset: String(input.offset ?? 0),
  })
}
