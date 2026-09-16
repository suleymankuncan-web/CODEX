/** Fixture tools may only use plain loopback URLs, never driver query overrides. */
export function localRankingCacheUrl(name: string, value: string | undefined, protocols: readonly string[]): URL {
  const invalid = () => new Error(`${name} must be an explicit loopback URL without query parameters or fragments`);
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw invalid(); }
  // pg and ioredis can interpret query options differently from URL.hostname.
  // Reject all options before a driver is constructed or any fixture I/O occurs.
  if (!protocols.includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.search || url.hash) {
    throw invalid();
  }
  return url;
}
