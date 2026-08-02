import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStoreRouteRegistryRoutes } from './system-flow-store-route-registry.mjs'
import {
  buildApiFunctionDependencyIndex,
  findImportedApiFunctionCallIds,
  parseFrontendApiCallTargets,
} from './system-flow-api-call-graph.mjs'

export {
  classifyFrontendApiCallTargets,
  resolveTransitiveApiCallIds,
} from './system-flow-api-call-graph.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultRootDir = path.resolve(scriptDir, '..')
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const controllerMethodByDecorator = {
  Delete: 'DELETE',
  Get: 'GET',
  Patch: 'PATCH',
  Post: 'POST',
  Put: 'PUT',
}

export function buildSystemFlow(input = {}) {
  const rootDir = path.resolve(input.rootDir ?? defaultRootDir)
  const routeLoaders = parseRouteLoaders(rootDir)
  const frontendRoutes = parseFrontendRoutes(rootDir, routeLoaders)
  const backendEndpoints = parseBackendEndpoints(rootDir)
  const openApiEndpoints = parseOpenApiEndpoints(rootDir)
  const apiUsageResult = parseFrontendApiUsage(rootDir)

  linkApiUsageToBackend(apiUsageResult.apiCalls, backendEndpoints, openApiEndpoints)
  const routeToApiEdges = linkRoutesToApiCalls(
    rootDir,
    frontendRoutes,
    routeLoaders,
    apiUsageResult,
  )
  const apiToEndpointEdges = buildApiToEndpointEdges(apiUsageResult.apiCalls)
  const endpointStats = buildEndpointStats(backendEndpoints, apiUsageResult.apiCalls)
  const controllerStats = buildControllerStats(backendEndpoints, endpointStats)

  const unmatchedApiCalls = apiUsageResult.apiCalls
    .filter((call) => !call.backendEndpointId)
    .map((call) => call.id)
  const backendEndpointsWithoutFrontendCalls = backendEndpoints
    .filter((endpoint) => (endpointStats.get(endpoint.id)?.frontendCallCount ?? 0) === 0)
    .map((endpoint) => endpoint.id)
  const routesWithoutApiCalls = frontendRoutes
    .filter((route) => route.kind === 'page')
    .filter((route) => !routeToApiEdges.some((edge) => edge.routeId === route.id))
    .map((route) => route.id)

  return {
    generatedAt: new Date().toISOString(),
    generator: {
      name: 'store-ops-system-flow',
      version: 1,
    },
    summary: {
      backendEndpointCount: backendEndpoints.length,
      backendEndpointsWithoutFrontendCallCount: backendEndpointsWithoutFrontendCalls.length,
      controllerCount: controllerStats.length,
      frontendApiCallCount: apiUsageResult.apiCalls.length,
      frontendRouteCount: frontendRoutes.length,
      matchedFrontendApiCallCount: apiUsageResult.apiCalls.length - unmatchedApiCalls.length,
      openApiEndpointCount: openApiEndpoints.length,
      routeApiEdgeCount: routeToApiEdges.length,
      routesWithoutApiCallCount: routesWithoutApiCalls.length,
      unmatchedFrontendApiCallCount: unmatchedApiCalls.length,
      unresolvedFrontendApiCallCount: apiUsageResult.unresolvedApiCalls.length,
    },
    frontendRoutes,
    frontendApiCalls: apiUsageResult.apiCalls,
    unresolvedFrontendApiCalls: apiUsageResult.unresolvedApiCalls,
    backendEndpoints,
    openApiEndpoints,
    edges: {
      routeToApi: routeToApiEdges,
      apiToEndpoint: apiToEndpointEdges,
    },
    hotspots: {
      endpointsByFrontendCallCount: [...endpointStats.values()]
        .filter((item) => item.frontendCallCount > 0)
        .sort(compareCountThenId)
        .slice(0, 20),
      controllersByEndpointCount: controllerStats,
    },
    risks: {
      backendEndpointsWithoutFrontendCalls,
      routesWithoutApiCalls,
      unmatchedApiCalls,
      unresolvedFrontendApiCalls: apiUsageResult.unresolvedApiCalls.map((call) => call.id),
    },
  }
}

export function renderSystemFlowHtml(flow) {
  const embeddedFlow = JSON.stringify(flow)
    .replaceAll('</script>', '<\\/script>')
    .replaceAll('<!--', '<\\!--')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Store Ops System Flow</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --panel-soft: #f9fbfd;
      --line: #d8e0ea;
      --text: #1f2937;
      --muted: #667085;
      --accent: #0f766e;
      --accent-soft: #d9f3ef;
      --warning: #9a3412;
      --warning-soft: #fff3e6;
      --danger: #b42318;
      --danger-soft: #fff0f0;
      --shadow: 0 16px 40px rgba(31, 41, 55, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }

    header {
      background: #101828;
      color: #ffffff;
      padding: 28px clamp(18px, 4vw, 48px);
    }

    header h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
    }

    header p {
      margin: 12px 0 0;
      max-width: 900px;
      color: #d0d5dd;
    }

    main {
      display: grid;
      gap: 20px;
      padding: 24px clamp(14px, 3vw, 36px) 40px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .metric,
    .panel,
    .route-card,
    .endpoint-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }

    .metric {
      padding: 16px;
    }

    .metric span,
    .eyebrow {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .metric strong {
      display: block;
      margin-top: 6px;
      font-size: 28px;
    }

    .toolbar {
      align-items: end;
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, 220px));
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    input,
    select {
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      font: inherit;
      padding: 8px 10px;
      width: 100%;
    }

    .panel {
      padding: 18px;
    }

    .panel h2,
    .panel h3 {
      margin: 4px 0 8px;
    }

    .panel-copy {
      margin: 0 0 16px;
      color: var(--muted);
    }

    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    .route-card,
    .endpoint-card {
      overflow: hidden;
    }

    .card-head {
      display: grid;
      gap: 8px;
      padding: 14px;
      background: var(--panel-soft);
      border-bottom: 1px solid var(--line);
    }

    .card-head strong {
      overflow-wrap: anywhere;
    }

    .card-body {
      display: grid;
      gap: 10px;
      padding: 14px;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .pill {
      align-items: center;
      background: #eef2f6;
      border-radius: 999px;
      color: #344054;
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      gap: 5px;
      padding: 4px 8px;
      white-space: nowrap;
    }

    .pill.get { background: #e8f6ef; color: #027a48; }
    .pill.post { background: #eff4ff; color: #175cd3; }
    .pill.put,
    .pill.patch { background: var(--warning-soft); color: var(--warning); }
    .pill.delete,
    .pill.unmatched { background: var(--danger-soft); color: var(--danger); }
    .pill.openapi { background: var(--accent-soft); color: var(--accent); }

    .api-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .api-list li {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px;
    }

    .path {
      color: #344054;
      display: block;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .meta {
      color: var(--muted);
      font-size: 12px;
    }

    .risk-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .risk-list li {
      background: var(--panel-soft);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px;
    }

    .hidden {
      display: none !important;
    }

    @media (max-width: 760px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      main {
        padding-inline: 12px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Generated from repository source</div>
    <h1>Store Ops System Flow</h1>
    <p>Frontend routes, API client calls, backend controllers, and OpenAPI coverage are derived from the checked-in code. This page is a map for dependency pressure and drift; it is not runtime evidence.</p>
  </header>
  <main>
    <section class="summary-grid" id="summary"></section>
    <section class="panel">
      <div class="toolbar">
        <label>Search
          <input id="search" type="search" placeholder="Route, endpoint, component, controller">
        </label>
        <label>Surface
          <select id="surface"></select>
        </label>
        <label>Domain
          <select id="domain"></select>
        </label>
        <label>Signal
          <select id="signal">
            <option value="all">All</option>
            <option value="linked">Linked route/API</option>
            <option value="unlinked">No route/API edge</option>
            <option value="unmatched">Unmatched API call</option>
          </select>
        </label>
      </div>
    </section>
    <section class="panel">
      <div class="eyebrow">Route to API flow</div>
      <h2>Frontend Surfaces</h2>
      <p class="panel-copy">Each card shows the route guard, component, and API calls reachable through imported API functions.</p>
      <div class="grid" id="routes"></div>
    </section>
    <section class="panel">
      <div class="eyebrow">Endpoint pressure</div>
      <h2>Backend Controllers</h2>
      <p class="panel-copy">Endpoints are grouped by controller and annotated with frontend call counts and OpenAPI coverage.</p>
      <div class="grid" id="endpoints"></div>
    </section>
    <section class="panel">
      <div class="eyebrow">Follow-up signals</div>
      <h2>Drift And Coverage Watchlist</h2>
      <div class="grid">
        <div>
          <h3>Unmatched frontend API calls</h3>
          <ul class="risk-list" id="unmatchedCalls"></ul>
        </div>
        <div>
          <h3>Page routes without API calls</h3>
          <ul class="risk-list" id="routesWithoutApi"></ul>
        </div>
        <div>
          <h3>Backend endpoints without frontend calls</h3>
          <ul class="risk-list" id="unusedEndpoints"></ul>
        </div>
      </div>
    </section>
  </main>
  <script>
    window.STORE_OPS_SYSTEM_FLOW = ${embeddedFlow};

    const flow = window.STORE_OPS_SYSTEM_FLOW;
    const endpointById = new Map(flow.backendEndpoints.map((endpoint) => [endpoint.id, endpoint]));
    const callById = new Map(flow.frontendApiCalls.map((call) => [call.id, call]));
    const linkedEndpointIds = new Set(flow.edges.apiToEndpoint.map((edge) => edge.backendEndpointId));
    const routeEdges = new Map();

    for (const edge of flow.edges.routeToApi) {
      const list = routeEdges.get(edge.routeId) || [];
      list.push(edge);
      routeEdges.set(edge.routeId, list);
    }

    const controls = {
      domain: document.getElementById('domain'),
      search: document.getElementById('search'),
      signal: document.getElementById('signal'),
      surface: document.getElementById('surface'),
    };

    function unique(values) {
      return [...new Set(values)].sort();
    }

    function fillSelect(select, label, values) {
      select.innerHTML = '<option value="all">' + label + '</option>' +
        values.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join('');
    }

    fillSelect(controls.surface, 'All surfaces', unique(flow.frontendRoutes.map((route) => route.surface)));
    fillSelect(controls.domain, 'All domains', unique(flow.backendEndpoints.map((endpoint) => endpoint.domain)));

    for (const control of Object.values(controls)) {
      control.addEventListener('input', render);
      control.addEventListener('change', render);
    }

    renderSummary();
    render();

    function renderSummary() {
      const metrics = [
        ['Frontend routes', flow.summary.frontendRouteCount],
        ['API calls', flow.summary.frontendApiCallCount],
        ['Matched API calls', flow.summary.matchedFrontendApiCallCount],
        ['Backend endpoints', flow.summary.backendEndpointCount],
        ['OpenAPI endpoints', flow.summary.openApiEndpointCount],
        ['Route/API edges', flow.summary.routeApiEdgeCount],
      ];

      document.getElementById('summary').innerHTML = metrics.map(([label, value]) => (
        '<article class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + '</strong></article>'
      )).join('');
    }

    function render() {
      const state = currentFilterState();
      renderRoutes(state);
      renderEndpoints(state);
      renderRisks(state);
    }

    function currentFilterState() {
      return {
        domain: controls.domain.value,
        search: controls.search.value.trim().toLowerCase(),
        signal: controls.signal.value,
        surface: controls.surface.value,
      };
    }

    function routeMatches(route, state) {
      const edges = routeEdges.get(route.id) || [];
      const calls = edges.map((edge) => callById.get(edge.apiCallId)).filter(Boolean);
      const endpointIds = calls.map((call) => call.backendEndpointId).filter(Boolean);
      const endpoints = endpointIds.map((id) => endpointById.get(id)).filter(Boolean);
      const haystack = [
        route.path,
        route.component,
        route.surface,
        route.guard,
        route.roles.join(' '),
        ...calls.map((call) => call.path),
        ...endpoints.map((endpoint) => endpoint.controller),
      ].join(' ').toLowerCase();

      if (state.surface !== 'all' && route.surface !== state.surface) return false;
      if (state.domain !== 'all' && !endpoints.some((endpoint) => endpoint.domain === state.domain)) return false;
      if (state.search && !haystack.includes(state.search)) return false;
      if (state.signal === 'linked' && edges.length === 0) return false;
      if (state.signal === 'unlinked' && edges.length > 0) return false;
      if (state.signal === 'unmatched' && !calls.some((call) => !call.backendEndpointId)) return false;
      return true;
    }

    function renderRoutes(state) {
      const routes = flow.frontendRoutes.filter((route) => routeMatches(route, state));
      document.getElementById('routes').innerHTML = routes.map((route) => {
        const edges = routeEdges.get(route.id) || [];
        const calls = edges.map((edge) => callById.get(edge.apiCallId)).filter(Boolean);
        return '<article class="route-card">' +
          '<div class="card-head">' +
            '<strong>' + escapeHtml(route.path) + '</strong>' +
            '<span class="meta">' + escapeHtml(route.component || route.kind) + ' / ' + escapeHtml(route.source.file) + ':' + route.source.line + '</span>' +
            '<div class="pill-row">' +
              '<span class="pill">' + escapeHtml(route.surface) + '</span>' +
              '<span class="pill">' + escapeHtml(route.guard) + '</span>' +
              route.roles.map((role) => '<span class="pill">' + escapeHtml(role) + '</span>').join('') +
            '</div>' +
          '</div>' +
          '<div class="card-body">' +
            (calls.length ? '<ul class="api-list">' + calls.map(renderApiCall).join('') + '</ul>' : '<span class="meta">No linked API call found in the reachable frontend module graph.</span>') +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderApiCall(call) {
      const endpoint = call.backendEndpointId ? endpointById.get(call.backendEndpointId) : null;
      const openApiClass = call.openApiCovered ? ' openapi' : '';
      return '<li>' +
        '<div class="pill-row">' +
          '<span class="pill ' + call.method.toLowerCase() + '">' + escapeHtml(call.method) + '</span>' +
          '<span class="pill' + openApiClass + '">' + (call.openApiCovered ? 'OpenAPI' : escapeHtml(call.client)) + '</span>' +
          (endpoint ? '<span class="pill">' + escapeHtml(endpoint.controller) + '</span>' : '<span class="pill unmatched">No controller match</span>') +
        '</div>' +
        '<span class="path">' + escapeHtml(call.path) + '</span>' +
        '<span class="meta">' + escapeHtml(call.source.file) + ':' + call.source.line + (call.exportedFunction ? ' / ' + escapeHtml(call.exportedFunction) : '') + '</span>' +
      '</li>';
    }

    function endpointMatches(endpoint, state) {
      const isLinked = linkedEndpointIds.has(endpoint.id);
      const haystack = [endpoint.path, endpoint.method, endpoint.controller, endpoint.domain, endpoint.source.file].join(' ').toLowerCase();
      if (state.domain !== 'all' && endpoint.domain !== state.domain) return false;
      if (state.search && !haystack.includes(state.search)) return false;
      if (state.signal === 'linked' && !isLinked) return false;
      if (state.signal === 'unlinked' && isLinked) return false;
      if (state.signal === 'unmatched') return false;
      return true;
    }

    function renderEndpoints(state) {
      const endpoints = flow.backendEndpoints.filter((endpoint) => endpointMatches(endpoint, state));
      document.getElementById('endpoints').innerHTML = endpoints.slice(0, 120).map((endpoint) => {
        const frontendCallCount = flow.frontendApiCalls.filter((call) => call.backendEndpointId === endpoint.id).length;
        return '<article class="endpoint-card">' +
          '<div class="card-head">' +
            '<div class="pill-row">' +
              '<span class="pill ' + endpoint.method.toLowerCase() + '">' + escapeHtml(endpoint.method) + '</span>' +
              '<span class="pill">' + escapeHtml(endpoint.controller) + '</span>' +
              (endpoint.openApiCovered ? '<span class="pill openapi">OpenAPI</span>' : '<span class="pill unmatched">OpenAPI gap</span>') +
            '</div>' +
            '<strong class="path">' + escapeHtml(endpoint.path) + '</strong>' +
          '</div>' +
          '<div class="card-body">' +
            '<span class="meta">Frontend calls: ' + frontendCallCount + '</span>' +
            '<span class="meta">' + escapeHtml(endpoint.source.file) + ':' + endpoint.source.line + '</span>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderRisks(state) {
      renderRiskList('unmatchedCalls', flow.risks.unmatchedApiCalls, (id) => {
        const call = callById.get(id);
        return call ? call.method + ' ' + call.path + ' (' + call.source.file + ':' + call.source.line + ')' : id;
      });
      renderRiskList('routesWithoutApi', flow.risks.routesWithoutApiCalls, (id) => {
        const route = flow.frontendRoutes.find((item) => item.id === id);
        return route ? route.path + ' (' + route.component + ')' : id;
      });
      renderRiskList('unusedEndpoints', flow.risks.backendEndpointsWithoutFrontendCalls.slice(0, 60), (id) => {
        const endpoint = endpointById.get(id);
        return endpoint ? endpoint.method + ' ' + endpoint.path + ' (' + endpoint.controller + ')' : id;
      });
    }

    function renderRiskList(id, values, formatter) {
      const list = document.getElementById(id);
      list.innerHTML = values.length
        ? values.map((value) => '<li><span class="path">' + escapeHtml(formatter(value)) + '</span></li>').join('')
        : '<li><span class="meta">No items.</span></li>';
    }

    function escapeHtml(input) {
      return String(input)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
  </script>
</body>
</html>
`
}

export function writeSystemFlowOutputs(input = {}) {
  const rootDir = path.resolve(input.rootDir ?? defaultRootDir)
  const flow = buildSystemFlow({ rootDir })
  const outputDir = path.join(rootDir, 'docs', 'flows')
  mkdirSync(outputDir, { recursive: true })

  const jsonPath = path.join(outputDir, 'store-ops-system-flow.json')
  const htmlPath = path.join(outputDir, 'store-ops-system-flow.html')
  writeFileSync(jsonPath, `${JSON.stringify(flow, null, 2)}\n`)
  writeFileSync(htmlPath, renderSystemFlowHtml(flow))

  return {
    flow,
    htmlPath,
    jsonPath,
  }
}

function parseRouteLoaders(rootDir) {
  const file = path.join(rootDir, 'admin-web', 'src', 'app', 'route-loaders.tsx')
  const text = readFileSync(file, 'utf8')
  const moduleDir = path.dirname(file)
  const loaders = new Map()
  const loaderRegex =
    /const\s+load[A-Za-z0-9_]+\s*=\s*\(\)\s*=>\s*import\('([^']+)'\)\.then\(\(module\)\s*=>\s*\(\{\s*default:\s*module\.([A-Za-z0-9_]+)/g

  for (const match of text.matchAll(loaderRegex)) {
    const component = match[2]
    loaders.set(component, {
      component,
      file: toRepoPath(rootDir, resolveModulePath(moduleDir, match[1])),
    })
  }

  return loaders
}

function parseFrontendRoutes(rootDir, routeLoaders) {
  const shells = [
    { file: 'admin-web/src/app/admin-shell.tsx', surface: 'admin' },
    { file: 'admin-web/src/app/store-shell.tsx', surface: 'store' },
    { file: 'admin-web/src/app/auth-flow-shell.tsx', surface: 'auth' },
  ]
  const routes = []

  for (const shell of shells) {
    if (shell.surface === 'store') { routes.push(...parseStoreRouteRegistryRoutes(rootDir)); continue }
    const text = readFileSync(path.join(rootDir, shell.file), 'utf8')
    const shellLocalComponents = parseShellLocalComponentImports(rootDir, shell.file, text)
    for (const block of collectRouteBlocks(text)) {
      const pathMatch = block.text.match(/\bpath="([^"]+)"/)
      if (!pathMatch) continue

      const routePath = pathMatch[1]
      const component = extractRouteComponent(block.text)
      const loader = component ? routeLoaders.get(component) : null
      const localComponent = component ? shellLocalComponents.get(component) : null
      const resolvedLocalComponentFile = component && localComponent?.file
        ? resolveLocalRouteComponentFile(rootDir, localComponent.file, component, routeLoaders)
        : null
      const roles = extractRouteRoles(block.text, shell.surface)
      const allowVm = /allowVm:\s*true/.test(block.text)
      const kind = component === 'Navigate' ? 'redirect' : component ? 'page' : 'unknown'
      routes.push({
        id: `route:${shell.surface}:${routePath}`,
        path: routePath,
        surface: shell.surface,
        domain: inferRouteDomain(routePath),
        kind,
        component: component ?? null,
        componentFile: loader?.file ?? resolvedLocalComponentFile ?? localComponent?.file ?? null,
        guard: extractRouteGuard(block.text, shell.surface),
        roles: allowVm ? uniqueSorted([...roles, 'VISUAL_MERCHANDISER']) : roles,
        source: {
          file: shell.file,
          line: block.startLine,
        },
      })
    }
  }

  return sortBy(routes, (route) => `${route.path}:${route.surface}`)
}

function parseShellLocalComponentImports(rootDir, shellFile, text) {
  return parseLocalNamedComponentImports(rootDir, shellFile, text)
}

function parseLocalNamedComponentImports(rootDir, sourceFile, text, routeLoaders = new Map()) {
  const imports = new Map()
  const sourcePath = path.join(rootDir, fromRepoPath(sourceFile))

  for (const statement of parseNamedImportStatements(text)) {
    if (statement.isTypeOnly) continue
    const specifier = statement.specifier
    if (!specifier.startsWith('.')) continue

    const resolved = resolveModulePath(path.dirname(sourcePath), specifier)
    if (!resolved) continue

    for (const namedImport of parseNamedImports(statement.imports)) {
      const loader = routeLoaders.get(namedImport.imported)
      imports.set(namedImport.local, {
        component: namedImport.local,
        file: loader?.file ?? toRepoPath(rootDir, resolved),
      })
    }
  }

  return imports
}

function resolveLocalRouteComponentFile(rootDir, repoFile, component, routeLoaders) {
  const file = path.join(rootDir, fromRepoPath(repoFile))
  if (!existsSync(file)) return null

  const text = readFileSync(file, 'utf8')
  const body = extractFunctionBody(text, component)
  if (!body) return null

  const imports = parseLocalNamedComponentImports(rootDir, repoFile, text, routeLoaders)
  const returnedComponent = extractPrimaryJsxComponent(body)
  if (!returnedComponent) return null

  return imports.get(returnedComponent)?.file ?? null
}

function collectRouteBlocks(text) {
  const lines = text.split(/\r?\n/)
  const blocks = []
  let current = null

  lines.forEach((line, index) => {
    if (!current && /<Route(?:\s|\/|>|$)/.test(line)) {
      current = { lines: [], startLine: index + 1 }
    }

    if (current) {
      current.lines.push(line)
      const isSingleLineRoute = current.lines.length === 1 && line.trim().endsWith('/>')
      const isRouteClosingLine = line.trim() === '/>'
      if (isSingleLineRoute || isRouteClosingLine) {
        blocks.push({
          startLine: current.startLine,
          text: current.lines.join('\n'),
        })
        current = null
      }
    }
  })

  return blocks
}

function extractRouteComponent(block) {
  const adminMatch = block.match(/adminRoute\(\s*\[[\s\S]*?\]\s*,\s*<([A-Z][A-Za-z0-9_]*)/)
  if (adminMatch) return adminMatch[1]

  const storeMatch = block.match(/storeRoute\(\s*<([A-Z][A-Za-z0-9_]*)/)
  if (storeMatch) return storeMatch[1]

  const elementMatch = block.match(/element=\{\s*<([A-Z][A-Za-z0-9_]*)/)
  if (elementMatch) return elementMatch[1]

  return extractPrimaryJsxComponent(block)
}

function extractPrimaryJsxComponent(block) {
  const components = [...block.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map((match) => match[1])
  const ignored = new Set(['Route'])
  const primary = components.find((component) => !ignored.has(component) && component !== 'Navigate')

  return primary ?? (components.includes('Navigate') ? 'Navigate' : null)
}

function extractRouteRoles(block, surface) {
  const rolesMatch = block.match(/adminRoute\(\s*\[([\s\S]*?)\]/)
  if (rolesMatch) {
    return uniqueSorted([...rolesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]))
  }

  if (surface === 'store' && block.includes('storeRoute(')) {
    return ['STORE_ACCESS']
  }

  return []
}

function extractRouteGuard(block, surface) {
  if (block.includes('adminRoute(')) return 'AdminRouteGuard'
  if (block.includes('storeRoute(')) return 'StoreRouteGuard'
  if (surface === 'auth') return 'AuthFlowShell'
  return 'none'
}

function parseBackendEndpoints(rootDir) {
  const files = walkFiles(path.join(rootDir, 'backend', 'nestjs', 'src'), (file) => file.endsWith('.controller.ts'))
  const endpoints = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const repoFile = toRepoPath(rootDir, file)
    const controllerPath = extractControllerPath(text)
    const controller = path.basename(file).replace(/\.controller\.ts$/, '')
    const methodRegex = /@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:([`'"])([\s\S]*?)\2)?\s*\)/g

    for (const match of text.matchAll(methodRegex)) {
      const method = controllerMethodByDecorator[match[1]]
      const endpointPath = toApiPath(joinRoutePaths(controllerPath, match[3] ?? ''))
      endpoints.push({
        id: `endpoint:${method}:${toOpenApiPattern(endpointPath)}`,
        method,
        path: toOpenApiPattern(endpointPath),
        rawControllerPath: controllerPath,
        rawMethodPath: match[3] ?? '',
        controller,
        domain: inferApiDomain(endpointPath),
        openApiCovered: false,
        source: {
          file: repoFile,
          line: lineNumberAt(text, match.index ?? 0),
        },
      })
    }
  }

  return sortBy(endpoints, (endpoint) => `${endpoint.path}:${endpoint.method}:${endpoint.source.file}`)
}

function extractControllerPath(text) {
  const quoted = text.match(/@Controller\s*\(\s*([`'"])([\s\S]*?)\1\s*\)/)
  if (quoted) return quoted[2]
  return /@Controller\s*\(\s*\)/.test(text) ? '' : ''
}

function parseOpenApiEndpoints(rootDir) {
  const openApiPath = path.join(rootDir, 'docs', 'api', 'openapi.json')
  const openApi = JSON.parse(readFileSync(openApiPath, 'utf8'))
  const endpoints = []

  for (const [pathName, definition] of Object.entries(openApi.paths ?? {})) {
    for (const method of httpMethods) {
      if (definition[method.toLowerCase()]) {
        endpoints.push({
          id: `openapi:${method}:${toOpenApiPattern(pathName)}`,
          method,
          path: toOpenApiPattern(pathName),
          domain: inferApiDomain(pathName),
        })
      }
    }
  }

  return sortBy(endpoints, (endpoint) => `${endpoint.path}:${endpoint.method}`)
}

function parseFrontendApiUsage(rootDir) {
  const files = walkFiles(path.join(rootDir, 'admin-web', 'src'), (file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file))
  const apiCalls = []
  const unresolvedApiCalls = []
  const apiFunctionIndex = new Map()
  const exportedFunctionIndex = new Map()

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const repoFile = toRepoPath(rootDir, file)
    if (repoFile === 'admin-web/src/lib/api.ts' || repoFile === 'admin-web/src/lib/openapi-client.ts') {
      continue
    }

    const functionRanges = extractNamedFunctionRanges(text)

    for (const range of functionRanges) {
      exportedFunctionIndex.set(`${repoFile}#${range.name}`, {
        body: text.slice(range.bodyStart, range.bodyEnd + 1),
        file,
        text,
      })
    }

    const extractedCalls = parseFrontendApiCallTargets(text)

    for (const unresolved of extractedCalls.unresolved) {
      const containingFunction = functionRanges.find(
        (range) => unresolved.index >= range.start && unresolved.index <= range.end,
      )
      unresolvedApiCalls.push({
        id: `unresolved-api:${unresolvedApiCalls.length + 1}`,
        client: unresolved.client,
        functionName: unresolved.functionName,
        method: unresolved.method,
        reason: 'non_literal_path',
        exportedFunction: containingFunction?.isExported ? containingFunction.name : null,
        source: {
          file: repoFile,
          line: lineNumberAt(text, unresolved.index),
        },
      })
    }

    for (const call of extractedCalls.calls) {
      const containingFunction = functionRanges.find((range) => call.index >= range.start && call.index <= range.end)
      const apiCall = {
        id: `api:${apiCalls.length + 1}`,
        client: call.client,
        functionName: call.functionName,
        method: call.method,
        rawPath: call.rawPath,
        path: normalizeClientApiPath(call.rawPath),
        backendEndpointId: null,
        openApiCovered: false,
        exportedFunction: containingFunction?.isExported ? containingFunction.name : null,
        source: {
          file: repoFile,
          line: lineNumberAt(text, call.index),
        },
      }
      apiCalls.push(apiCall)

      if (containingFunction) {
        const key = `${repoFile}#${containingFunction.name}`
        const list = apiFunctionIndex.get(key) ?? []
        list.push(apiCall.id)
        apiFunctionIndex.set(key, list)
      }
    }
  }

  return {
    apiCalls: sortBy(apiCalls, (call) => `${call.source.file}:${String(call.source.line).padStart(5, '0')}:${call.id}`),
    apiFunctionDependencyIndex: buildApiFunctionDependencyIndex({
      exportedFunctionIndex,
      parseNamedImportStatements,
      parseNamedImports,
      resolveModulePath,
      rootDir,
      toRepoPath,
    }),
    apiFunctionIndex,
    unresolvedApiCalls: sortBy(
      unresolvedApiCalls,
      (call) => `${call.source.file}:${String(call.source.line).padStart(5, '0')}:${call.id}`,
    ),
  }
}

function extractNamedFunctionRanges(text) {
  const ranges = []
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g

  for (const match of text.matchAll(functionRegex)) {
    const start = match.index ?? 0
    const bodyRange = extractFunctionBodyRange(text, start, match[0].length)
    if (!bodyRange) continue
    ranges.push({
      name: match[1],
      start,
      end: bodyRange.end,
      bodyStart: bodyRange.start,
      bodyEnd: bodyRange.end, isExported: match[0].trimStart().startsWith('export '),
    })
  }

  return ranges
}

function extractFunctionBody(text, functionName) {
  const functionRegex = new RegExp(`(?:export\\s+)?function\\s+${escapeRegExp(functionName)}\\s*\\(`)
  const match = functionRegex.exec(text)
  if (!match) return null

  const bodyRange = extractFunctionBodyRange(text, match.index, match[0].length)
  return bodyRange ? text.slice(bodyRange.start, bodyRange.end + 1) : null
}

function extractFunctionBodyRange(text, functionStart, matchLength) {
  const paramsOpen = functionStart + matchLength - 1
  const paramsEnd = findBalancedEnd(text, paramsOpen, '(', ')')
  if (paramsEnd === -1) return null

  const bodyStart = text.indexOf('{', paramsEnd)
  if (bodyStart === -1) return null

  const bodyEnd = findBalancedEnd(text, bodyStart, '{', '}')
  if (bodyEnd === -1) return null

  return { start: bodyStart, end: bodyEnd }
}

function linkApiUsageToBackend(apiCalls, backendEndpoints, openApiEndpoints) {
  for (const endpoint of backendEndpoints) {
    endpoint.openApiCovered = Boolean(findMatchingEndpoint(endpoint, openApiEndpoints))
  }

  for (const call of apiCalls) {
    const backendEndpoint = findMatchingEndpoint(call, backendEndpoints)
    const openApiEndpoint = findMatchingEndpoint(call, openApiEndpoints)
    call.backendEndpointId = backendEndpoint?.id ?? null
    call.openApiCovered = Boolean(openApiEndpoint)
  }
}

function linkRoutesToApiCalls(rootDir, frontendRoutes, routeLoaders, apiUsageResult) {
  const apiCallIdsByRoute = new Map()
  const apiCallById = new Map(apiUsageResult.apiCalls.map((call) => [call.id, call]))

  for (const route of frontendRoutes) {
    if (!route.componentFile) continue
    const entry = path.join(rootDir, fromRepoPath(route.componentFile))
    const reachableFiles = collectReachableFrontendFiles(rootDir, entry)
    const apiCallIds = new Set()

    for (const file of reachableFiles) {
      const repoFile = toRepoPath(rootDir, file)
      const text = readFileSync(file, 'utf8')

      for (const callId of findImportedApiFunctionCallIds({
        apiFunctionDependencyIndex: apiUsageResult.apiFunctionDependencyIndex,
        apiFunctionIndex: apiUsageResult.apiFunctionIndex,
        file,
        parseNamedImportStatements,
        parseNamedImports,
        resolveModulePath,
        rootDir,
        text,
        toRepoPath,
      })) {
        apiCallIds.add(callId)
      }

      for (const call of apiUsageResult.apiCalls) {
        if (call.source.file === repoFile && !call.exportedFunction) {
          apiCallIds.add(call.id)
        }
      }
    }

    apiCallIdsByRoute.set(route.id, [...apiCallIds].sort((left, right) => {
      const leftCall = apiCallById.get(left)
      const rightCall = apiCallById.get(right)
      return `${leftCall?.path}:${leftCall?.method}`.localeCompare(`${rightCall?.path}:${rightCall?.method}`)
    }))
  }

  const edges = []
  for (const [routeId, apiCallIds] of apiCallIdsByRoute.entries()) {
    for (const apiCallId of apiCallIds) {
      edges.push({
        id: `edge:${routeId}:${apiCallId}`,
        routeId,
        apiCallId,
      })
    }
  }

  return sortBy(edges, (edge) => edge.id)
}

function collectReachableFrontendFiles(rootDir, entryFile) {
  const root = path.join(rootDir, 'admin-web', 'src')
  const visited = new Set()
  const queue = [{ file: entryFile, depth: 0 }]

  while (queue.length) {
    const current = queue.shift()
    const normalized = path.resolve(current.file)
    if (visited.has(normalized) || !normalized.startsWith(root) || !existsSync(normalized)) {
      continue
    }

    visited.add(normalized)
    if (current.depth >= 6) {
      continue
    }

    const text = readFileSync(normalized, 'utf8')
    for (const specifier of extractRelativeImports(text)) {
      const resolved = resolveModulePath(path.dirname(normalized), specifier)
      if (resolved && existsSync(resolved)) {
        queue.push({ file: resolved, depth: current.depth + 1 })
      }
    }
  }

  return [...visited].sort()
}

function extractRelativeImports(text) {
  const imports = []
  const importRegex = /^import\s+(?!type\b)[\s\S]*?\s+from\s+['"](\.[^'"]+)['"]/gm

  for (const match of text.matchAll(importRegex)) {
    imports.push(match[1])
  }

  return imports
}

function parseNamedImportStatements(text) {
  const statements = []
  const importRegex = /^import\s+(type\s+)?{([\s\S]*?)}\s+from\s+['"]([^'"]+)['"]/gm

  for (const match of text.matchAll(importRegex)) {
    statements.push({
      imports: match[2],
      isTypeOnly: Boolean(match[1]),
      specifier: match[3],
    })
  }

  return statements
}

function parseNamedImports(importText) {
  return importText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^type\s+/, '').trim())
    .filter((item) => item && /^[A-Za-z0-9_]+(?:\s+as\s+[A-Za-z0-9_]+)?$/.test(item))
    .map((item) => {
      const [imported, local] = item.split(/\s+as\s+/)
      return { imported, local: local ?? imported }
    })
}

function buildApiToEndpointEdges(apiCalls) {
  return sortBy(
    apiCalls
      .filter((call) => call.backendEndpointId)
      .map((call) => ({
        id: `edge:${call.id}:${call.backendEndpointId}`,
        apiCallId: call.id,
        backendEndpointId: call.backendEndpointId,
      })),
    (edge) => edge.id,
  )
}

function buildEndpointStats(backendEndpoints, apiCalls) {
  const stats = new Map()
  for (const endpoint of backendEndpoints) {
    stats.set(endpoint.id, {
      endpointId: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      controller: endpoint.controller,
      domain: endpoint.domain,
      frontendCallCount: 0,
    })
  }

  for (const call of apiCalls) {
    if (!call.backendEndpointId) continue
    const stat = stats.get(call.backendEndpointId)
    if (stat) {
      stat.frontendCallCount += 1
    }
  }

  return stats
}

function buildControllerStats(backendEndpoints, endpointStats) {
  const controllers = new Map()

  for (const endpoint of backendEndpoints) {
    const key = endpoint.controller
    const current = controllers.get(key) ?? {
      id: `controller:${key}`,
      controller: key,
      domain: endpoint.domain,
      endpointCount: 0,
      frontendCallCount: 0,
    }
    current.endpointCount += 1
    current.frontendCallCount += endpointStats.get(endpoint.id)?.frontendCallCount ?? 0
    controllers.set(key, current)
  }

  return [...controllers.values()].sort(compareCountThenId)
}

function findMatchingEndpoint(call, endpoints) {
  return endpoints.find((endpoint) => call.method === endpoint.method && pathPatternsMatch(call.path, endpoint.path))
}

function pathPatternsMatch(left, right) {
  const leftParts = normalizeApiPathForCompare(left).split('/').filter(Boolean)
  const rightParts = normalizeApiPathForCompare(right).split('/').filter(Boolean)
  if (leftParts.length !== rightParts.length) return false

  return leftParts.every((leftPart, index) => {
    const rightPart = rightParts[index]
    return leftPart === rightPart || (isPathParam(leftPart) && isPathParam(rightPart))
  })
}

function normalizeApiPathForCompare(input) {
  return toOpenApiPattern(input).replace(/\/+$/, '')
}

function isPathParam(input) {
  return /^\{[^}]+\}$/.test(input)
}

function normalizeClientApiPath(rawPath) {
  const trimmed = rawPath.trim().replace(/\$\{[^}]+}/g, '{dynamic}')
  const withoutQuery = trimmed.split('?')[0]
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const apiPath = withLeadingSlash.startsWith('/api/') ? withLeadingSlash : `/api${withLeadingSlash}`
  return toOpenApiPattern(apiPath)
}

function toApiPath(input) {
  const withLeadingSlash = input.startsWith('/') ? input : `/${input}`
  return withLeadingSlash.startsWith('/api/') ? withLeadingSlash : `/api${withLeadingSlash}`
}

function toOpenApiPattern(input) {
  return input
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\{dynamic}/g, '{dynamic}') || '/api'
}

function joinRoutePaths(left, right) {
  return [left, right]
    .map((part) => String(part ?? '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

function inferRouteDomain(routePath) {
  const segments = routePath.split('/').filter(Boolean)
  if (segments[0] === 'admin') return segments[1] ?? 'admin'
  if (segments[0] === 'store') return segments[1] ?? 'store'
  return segments[0] ?? 'root'
}

function inferApiDomain(apiPath) {
  const segments = apiPath.split('/').filter(Boolean)
  return segments[1] ?? segments[0] ?? 'root'
}

function resolveModulePath(fromDir, specifier) {
  const base = path.resolve(fromDir, specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
}

function walkFiles(dir, predicate) {
  const files = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate))
    } else if (predicate(fullPath)) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function skipWhitespace(text, index) {
  let cursor = index
  while (/\s/.test(text[cursor] ?? '')) cursor += 1
  return cursor
}

function skipTypeArguments(text, index) {
  if (text[index] !== '<') return index

  let depth = 0
  let quote = null
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (quote) {
      if (char === '\\') {
        cursor += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
    } else if (char === '<') {
      depth += 1
    } else if (char === '>') {
      depth -= 1
      if (depth === 0) {
        return cursor + 1
      }
    }
  }

  return index
}

function readQuoted(text, index) {
  const quote = text[index]
  if (quote !== '"' && quote !== "'" && quote !== '`') return null

  let value = ''
  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (char === '\\') {
      value += char
      cursor += 1
      value += text[cursor] ?? ''
      continue
    }
    if (char === quote) {
      return { end: cursor + 1, value }
    }
    value += char
  }

  return null
}

function readBalancedCall(text, openIndex) {
  const end = findBalancedEnd(text, openIndex, '(', ')')
  return end === -1 ? text.slice(openIndex, openIndex + 800) : text.slice(openIndex, end + 1)
}

function findBalancedEnd(text, openIndex, openChar, closeChar) {
  let depth = 0
  let quote = null

  for (let cursor = openIndex; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (quote) {
      if (char === '\\') {
        cursor += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
    } else if (char === openChar) {
      depth += 1
    } else if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return cursor
      }
    }
  }

  return -1
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function sortBy(items, mapper) {
  return [...items].sort((left, right) => mapper(left).localeCompare(mapper(right)))
}

function compareCountThenId(left, right) {
  if (right.frontendCallCount !== left.frontendCallCount) {
    return right.frontendCallCount - left.frontendCallCount
  }
  if (right.endpointCount !== left.endpointCount) {
    return right.endpointCount - left.endpointCount
  }
  return (left.endpointId ?? left.id).localeCompare(right.endpointId ?? right.id)
}

function toRepoPath(rootDir, file) {
  return path.relative(rootDir, file).replaceAll(path.sep, '/')
}

function fromRepoPath(file) {
  return file.split('/').join(path.sep)
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = writeSystemFlowOutputs()
  const relativeJson = toRepoPath(defaultRootDir, result.jsonPath)
  const relativeHtml = toRepoPath(defaultRootDir, result.htmlPath)
  console.log(`Wrote ${relativeJson}`)
  console.log(`Wrote ${relativeHtml}`)
  console.log(JSON.stringify(result.flow.summary, null, 2))
}
