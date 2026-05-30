type QueryResult<Row = unknown> = {
  rows: Row[];
};

export type RepositoryQueryMock = jest.Mock<
  Promise<QueryResult>,
  [sql: string, params?: unknown[]]
>;

export type ExecutedRepositoryQuery = {
  sql: string;
  params: unknown[];
};

export function createRepositoryQueryMock(
  rows: unknown[] = [],
): RepositoryQueryMock {
  return jest.fn().mockResolvedValue({ rows });
}

export function getExecutedQuery(
  query: RepositoryQueryMock,
  index = 0,
): ExecutedRepositoryQuery {
  const call = query.mock.calls[index];

  if (!call) {
    throw new Error(`Expected repository query call at index ${index}`);
  }

  return {
    sql: String(call[0]),
    params: call[1] ?? [],
  };
}

export function findExecutedQueries(
  query: RepositoryQueryMock,
  sqlFragment: string,
): ExecutedRepositoryQuery[] {
  return query.mock.calls
    .map((_, index) => getExecutedQuery(query, index))
    .filter((call) => call.sql.includes(sqlFragment));
}

export function findExecutedQuery(
  query: RepositoryQueryMock,
  sqlFragment: string,
): ExecutedRepositoryQuery | null {
  return findExecutedQueries(query, sqlFragment)[0] ?? null;
}
