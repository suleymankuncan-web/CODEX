export function sanitizeAuthReturnPath(input: string | null | undefined) {
  const value = input?.trim()

  if (!value?.startsWith('/')) {
    return null
  }

  if (value.startsWith('//') || value.startsWith('/\\') || value.startsWith('/auth')) {
    return null
  }

  return value
}
