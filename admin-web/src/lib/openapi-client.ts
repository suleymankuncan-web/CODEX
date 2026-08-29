import type { paths } from '../generated/openapi-types'
import { fetchJson, sendJson } from './api'

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

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type MutationOperation<Path extends keyof paths, Method extends MutationMethod> =
  paths[Path] extends Record<Lowercase<Method>, infer Operation> ? Operation : never

export type ApiGetResponse<Path extends keyof paths> = GetOperation<Path> extends { responses: infer Responses }
  ? FirstJsonSuccessResponse<Responses>
  : never

export type ApiMutationResponse<Path extends keyof paths, Method extends MutationMethod> = MutationOperation<
  Path,
  Method
> extends { responses: infer Responses }
  ? FirstJsonSuccessResponse<Responses>
  : never

export type ApiMutationBody<Path extends keyof paths, Method extends MutationMethod> = MutationOperation<
  Path,
  Method
> extends { requestBody: infer RequestBody }
  ? JsonContent<RequestBody>
  : never

type ApiMutationInput<Path extends keyof paths, Method extends MutationMethod> = {
  method: Method
  params?: Record<string, string | number>
  query?: string | URLSearchParams
} & ([ApiMutationBody<Path, Method>] extends [never]
  ? { body?: never }
  : { body: ApiMutationBody<Path, Method> })

export async function fetchOpenApiJson<Path extends keyof paths & `/api/${string}`>(
  path: Path,
  input?: {
    params?: Record<string, string | number>
    query?: string | URLSearchParams
    signal?: AbortSignal
  },
): Promise<ApiGetResponse<Path>> {
  return fetchJson<ApiGetResponse<Path>>(
    `${toClientApiPath(formatPathParams(path, input?.params))}${formatQuery(input?.query)}`,
    input?.signal ? { signal: input.signal } : undefined,
  )
}

export async function sendOpenApiJson<Path extends keyof paths & `/api/${string}`, Method extends MutationMethod>(
  path: Path,
  input: ApiMutationInput<Path, Method>,
): Promise<ApiMutationResponse<Path, Method>> {
  return sendJson<ApiMutationResponse<Path, Method>>(
    `${toClientApiPath(formatPathParams(path, input.params))}${formatQuery(input.query)}`,
    {
      method: input.method,
      body: (input as { body?: unknown }).body,
    },
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
