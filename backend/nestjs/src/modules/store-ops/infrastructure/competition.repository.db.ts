import { QueryResultRow } from "pg";

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};
