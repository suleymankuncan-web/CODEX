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
): Promise<ApiGetResponse<Path>> {
  return fetchJson<ApiGetResponse<Path>>(toClientApiPath(path))
}

function toClientApiPath(path: `/api/${string}`) {
  return path.slice('/api'.length) as `/${string}`
}
