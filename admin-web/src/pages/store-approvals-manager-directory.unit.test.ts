import { describe, expect, it } from 'vitest'
import { resolveRequestManagerDirectory } from './store-approvals-manager-directory'

describe('request center Region Manager directory', () => {
  it('keeps assigned managers visible when the shared directory response is empty', () => {
    expect(resolveRequestManagerDirectory([], [
      { storeId: 'store-a', regionManagerNames: ['Ayşe Demir'] },
      { storeId: 'store-b', regionManagerNames: ['Ayşe Demir', 'Can Kaya'] },
    ])).toEqual([
      { userId: 'request-manager:Ay%C5%9Fe%20Demir', displayName: 'Ayşe Demir', storeIds: ['store-a', 'store-b'] },
      { userId: 'request-manager:Can%20Kaya', displayName: 'Can Kaya', storeIds: ['store-b'] },
    ])
  })

  it('keeps the authoritative directory unchanged when it is available', () => {
    expect(resolveRequestManagerDirectory(
      [{ userId: 'manager-a', displayName: 'Ayşe Demir', storeIds: ['store-a'] }],
      [{ storeId: 'store-b', regionManagerNames: ['Ayşe Demir'] }],
    )).toEqual([{ userId: 'manager-a', displayName: 'Ayşe Demir', storeIds: ['store-a'] }])
  })
})
