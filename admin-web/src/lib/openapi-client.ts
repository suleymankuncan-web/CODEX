import type { paths } from '../generated/openapi-types'
import { fetchJson } from './api'

type JsonContent<Response> = Response extends { content: { 'application/json': infer Body } } ? Body : never

type ResponseForStatus<Responses, Status extends string> = Status extends keyof Responses
  ? JsonContent<Responses[Status]>
  : never

type FirstJsonSuccessResponse<Responses> =
  | ResponseForStatus<Responses, '200'>
  | ResponseForStatus<Responses, '201'>
  | ResponseForStatus<Responses, '202'>
  | ResponseForStatus<Responses, '204'>

type GetOperation<Path extends keyof paths> = paths[Path] extends { get: infer Operation } ? Operation : never

export type ApiGetResponse<Path extends keyof paths> = GetOperation<Path> extends { responses: infer Responses }
  ? FirstJsonSuccessResponse<Responses>
  : never

export async function fetchOpenApiJson<Path extends keyof paths & `/api/${string}`>(
  path: Path,
  input?: {
    params?: Record<string, string | number>
    query?: string | URLSearchParams
  },
): Promise<ApiGetResponse<Path>> {
  return fetchJson<ApiGetResponse<Path>>(
    `${toClientApiPath(formatPathParams(path, input?.params))}${formatQuery(input?.query)}`,
  )
}

function toClientApiPath(path: `/api/${string}`) {
  return path.slice('/api'.length) as `/${string}`
}

function formatPathParams(path: `/api/${string}`, params: Record<string, string | number> = {}) {
  return path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params[key]
    if (value === undefined) {
      throw new Error(`Missing OpenAPI path parameter: ${key}`)
    }

    return encodeURIComponent(String(value))
  }) as `/api/${string}`
}

function formatQuery(query?: string | URLSearchParams) {
  const value = typeof query === 'string' ? query : (query?.toString() ?? '')
  return value ? `?${value}` : ''
}
