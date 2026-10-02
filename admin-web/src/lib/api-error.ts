export class ApiError extends Error {
  status: number
  readonly retryAt: number | null

  constructor(status: number, message: string, retryAt: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAt = retryAt
  }
}
