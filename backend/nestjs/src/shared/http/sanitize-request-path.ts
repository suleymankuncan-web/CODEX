const SENSITIVE_QUERY_PARAM_PATTERN =
  /authorization|bearer|client_secret|code|cookie|id_token|password|refresh_token|secret|session|state|token/i;
const UUID_PATH_SEGMENT_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function sanitizeRequestPath(value: string): string {
  const queryIndex = value.indexOf("?");
  const rawPath = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
  const path = rawPath.replace(UUID_PATH_SEGMENT_PATTERN, ":id");
  const rawQuery = queryIndex >= 0 ? value.slice(queryIndex + 1) : "";

  if (!rawQuery) {
    return path;
  }

  const query = rawQuery.split("#", 1)[0];
  const params = new URLSearchParams(query);
  const sanitizedParams: string[] = [];

  params.forEach((_paramValue, key) => {
    sanitizedParams.push(
      `${encodeURIComponent(key)}=${
        SENSITIVE_QUERY_PARAM_PATTERN.test(key) ? "[redacted]" : ":value"
      }`,
    );
  });

  return sanitizedParams.length > 0
    ? `${path}?${sanitizedParams.join("&")}`
    : path;
}
