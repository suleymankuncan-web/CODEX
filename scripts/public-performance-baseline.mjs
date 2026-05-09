const frontendBaseUrl = trimTrailingSlash(
  process.env.PUBLIC_PERF_FRONTEND_BASE_URL ?? "https://staging.hr-axis.com",
);
const apiBaseUrl = trimTrailingSlash(
  process.env.PUBLIC_PERF_API_BASE_URL ?? "https://api-staging.hr-axis.com/api",
);
const iterations = readPositiveInteger(process.env.PUBLIC_PERF_ITERATIONS, 5);
const assetIterations = readPositiveInteger(process.env.PUBLIC_PERF_ASSET_ITERATIONS, 3);
const timeoutMs = readPositiveInteger(process.env.PUBLIC_PERF_TIMEOUT_MS, 45000);
const frontendRoutes = readList(
  process.env.PUBLIC_PERF_FRONTEND_ROUTES,
  ["/", "/store", "/store/me", "/store/kpis", "/store/rankings", "/admin/integrations"],
);
const apiPaths = readList(
  process.env.PUBLIC_PERF_API_PATHS,
  ["/health/live", "/health", "/auth/session"],
);

const routeSamples = [];
const apiSamples = [];
const assetSamples = [];

for (const route of frontendRoutes) {
  const url = `${frontendBaseUrl}${ensureLeadingSlash(route)}`;
  routeSamples.push(...(await measureUrl(`frontend ${route}`, url, iterations)));
}

for (const path of apiPaths) {
  const url = `${apiBaseUrl}${ensureLeadingSlash(path)}`;
  apiSamples.push(...(await measureUrl(`api ${path}`, url, iterations)));
}

const homeHtml = await fetchText(`${frontendBaseUrl}/`);
const assetUrls = extractAssetUrls(homeHtml, frontendBaseUrl);

for (const url of assetUrls) {
  assetSamples.push(...(await measureUrl(`asset ${getFileName(url)}`, url, assetIterations)));
}

const assetSummary = summarize(assetSamples);
const totalAssetBytes = assetSummary.reduce((sum, item) => sum + item.bytes, 0);

console.log(
  JSON.stringify(
    {
      status: "ok",
      frontendBaseUrl,
      apiBaseUrl,
      iterations,
      assetIterations,
      frontendRoutes: summarize(routeSamples),
      publicApi: summarize(apiSamples),
      assets: {
        totalKb: round(totalAssetBytes / 1024, 1),
        count: assetSummary.length,
        largest: [...assetSummary]
          .sort((left, right) => right.bytes - left.bytes)
          .slice(0, 10)
          .map((item) => ({
            file: item.label.replace(/^asset /, ""),
            kb: round(item.bytes / 1024, 1),
            p50Ms: item.p50Ms,
            p95Ms: item.p95Ms,
          })),
      },
    },
    null,
    2,
  ),
);

async function measureUrl(label, url, count) {
  const samples = [];

  for (let iteration = 0; iteration < count; iteration += 1) {
    const startedAt = performance.now();
    let status = 0;
    let bytes = 0;
    let error = null;

    try {
      const response = await fetchWithTimeout(url);
      status = response.status;
      bytes = (await response.arrayBuffer()).byteLength;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    samples.push({
      label,
      url,
      iteration: iteration + 1,
      status,
      durationMs: round(performance.now() - startedAt, 2),
      bytes,
      error,
    });
  }

  return samples;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function summarize(samples) {
  const groups = new Map();

  for (const sample of samples) {
    const current = groups.get(sample.label) ?? [];
    current.push(sample);
    groups.set(sample.label, current);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const durations = group.map((sample) => sample.durationMs).sort((left, right) => left - right);
      const avgMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
      const statuses = [...new Set(group.map((sample) => sample.status))].join(",");
      const errors = [
        ...new Set(group.map((sample) => sample.error).filter((error) => Boolean(error))),
      ];

      return {
        label,
        samples: group.length,
        statuses,
        minMs: round(durations[0] ?? 0, 2),
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        maxMs: round(durations[durations.length - 1] ?? 0, 2),
        avgMs: round(avgMs, 2),
        bytes: group[group.length - 1]?.bytes ?? 0,
        ...(errors.length > 0 ? { errors } : {}),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function extractAssetUrls(html, baseUrl) {
  const matches = html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g);
  const urls = [];

  for (const match of matches) {
    const rawUrl = match[1];
    urls.push(rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl}`);
  }

  return [...new Set(urls)];
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  return round(values[index] ?? 0, 2);
}

function readList(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function ensureLeadingSlash(value) {
  return value.startsWith("/") ? value : `/${value}`;
}

function getFileName(url) {
  return url.split("/").pop() ?? url;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}
