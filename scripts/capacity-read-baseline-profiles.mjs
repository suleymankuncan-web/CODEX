export const DEFAULT_API_BASE_URL = 'https://api-staging.hr-axis.com/api'
export const DEFAULT_ENVIRONMENT = 'staging'
export const DEFAULT_LEVELS = [1, 5]
export const DEFAULT_MAX_LEVEL = 50
export const DEFAULT_TIMEOUT_MS = 30_000
export const DEFAULT_TARGET_REGISTERED_USERS = 700

export const COMMON_TOKEN_ENVS = [
  'CAPACITY_BEARER_TOKEN',
  'PROTECTED_PERF_TOKEN',
  'PERF_AUTH_TOKEN',
  'SMOKE_AUTH_TOKEN',
  'PILOT_SMOKE_BEARER_TOKEN',
  'AUTH_SMOKE_BEARER_TOKEN',
]

const publicBudget = {
  minAvailability: 1,
  maxP50Ms: 500,
  maxP95Ms: 1_200,
  max5xx: 0,
  max429: 0,
  maxRequestErrors: 0,
}

const storeBudget = {
  minAvailability: 1,
  maxP50Ms: 900,
  maxP95Ms: 2_000,
  max5xx: 0,
  max429: 0,
  maxRequestErrors: 0,
}

const privilegedBudget = {
  minAvailability: 1,
  maxP50Ms: 1_000,
  maxP95Ms: 2_500,
  max5xx: 0,
  max429: 0,
  maxRequestErrors: 0,
}

const publicEndpoints = [
  { label: 'live health', method: 'GET', path: '/health/live' },
  { label: 'dependency health', method: 'GET', path: '/health' },
]

const storeReadEndpoints = [
  { label: 'auth session', method: 'GET', path: '/auth/session' },
  { label: 'kpi config', method: 'GET', path: '/reports/kpi-config' },
  {
    label: 'my performance monthly',
    method: 'GET',
    path: '/reports/my-performance?mode=live&periodType=monthly',
  },
  {
    label: 'rankings monthly',
    method: 'GET',
    path: '/reports/rankings?periodType=monthly&limit=20&offset=0',
  },
  {
    label: 'closed leaderboard monthly',
    method: 'GET',
    path: '/reports/leaderboards/closed?periodType=monthly&limit=10',
  },
]

export const PROFILE_DEFINITIONS = [
  {
    name: 'public',
    description: 'Public health endpoints used by uptime and deploy checks.',
    requiresAuth: false,
    budget: publicBudget,
    endpoints: publicEndpoints,
  },
  {
    name: 'store-manager',
    description: 'Store manager dashboard, KPI, ranking, and self-performance reads.',
    requiresAuth: true,
    tokenEnvs: [
      'CAPACITY_STORE_MANAGER_TOKEN',
      'BACKEND_LOAD_STORE_TOKEN',
      'PROTECTED_PERF_STORE_MANAGER_TOKEN',
    ],
    budget: storeBudget,
    endpoints: [
      ...storeReadEndpoints,
      {
        label: 'store kpi highlights',
        method: 'GET',
        path: '/reports/store-kpi-highlights?periodType=monthly',
      },
    ],
  },
  {
    name: 'region-manager',
    description: 'Region manager ranking, KPI highlight, workflow, and target-distribution reads.',
    requiresAuth: true,
    tokenEnvs: [
      'CAPACITY_REGION_MANAGER_TOKEN',
      'BACKEND_LOAD_REGION_MANAGER_TOKEN',
      'PROTECTED_PERF_REGION_MANAGER_TOKEN',
    ],
    budget: privilegedBudget,
    endpoints: [
      { label: 'auth session', method: 'GET', path: '/auth/session' },
      { label: 'snapshot runs', method: 'GET', path: '/reports/snapshot-runs?limit=10&offset=0' },
      { label: 'kpi config', method: 'GET', path: '/reports/kpi-config' },
      {
        label: 'rankings monthly',
        method: 'GET',
        path: '/reports/rankings?periodType=monthly&limit=20&offset=0',
      },
      {
        label: 'store kpi highlights',
        method: 'GET',
        path: '/reports/store-kpi-highlights?periodType=monthly',
      },
      {
        label: 'workflow inbox',
        method: 'GET',
        path: '/workflow/inbox?limit=20&offset=0',
      },
      {
        label: 'target distribution requests',
        method: 'GET',
        path: '/target-distributions/requests?limit=20&offset=0',
      },
      {
        label: 'target coverage',
        method: 'GET',
        path: '/target-distributions/coverage?requestMonth=2026-06-01',
      },
    ],
  },
  {
    name: 'admin',
    description: 'Super-admin or composite admin reporting, import, snapshot, and operation overview reads.',
    requiresAuth: true,
    allowCommonTokenFallback: false,
    tokenEnvs: [
      'CAPACITY_SUPER_ADMIN_TOKEN',
      'CAPACITY_ADMIN_READS_TOKEN',
      'PROTECTED_PERF_SUPER_ADMIN_TOKEN',
    ],
    budget: privilegedBudget,
    endpoints: [
      { label: 'auth session', method: 'GET', path: '/auth/session' },
      { label: 'reports summary', method: 'GET', path: '/reports/summary' },
      { label: 'import overview', method: 'GET', path: '/integrations/import-batches/overview' },
      { label: 'snapshot overview', method: 'GET', path: '/snapshots/runs/overview' },
      {
        label: 'import needs action',
        method: 'GET',
        path: '/integrations/import-batches/needs-action?limit=12&offset=0',
      },
      {
        label: 'snapshot needs action',
        method: 'GET',
        path: '/snapshots/runs/needs-action?limit=12&offset=0',
      },
    ],
  },
  {
    name: 'store-personnel',
    description: 'Store personnel self-performance and ranking reads.',
    requiresAuth: true,
    tokenEnvs: ['CAPACITY_STORE_PERSONNEL_TOKEN', 'PROTECTED_PERF_STORE_PERSONNEL_TOKEN'],
    budget: storeBudget,
    endpoints: storeReadEndpoints,
  },
]

export const EXCLUDED_MUTATION_ROUTES = [
  {
    method: 'POST',
    path: '/integrations/power-bi-export-upload',
    reason: 'Import upload parsing and worker execution are measured separately.',
  },
  {
    method: 'POST',
    path: '/integrations/import-batches',
    reason: 'Import command creation is a mutation and is excluded from read capacity checks.',
  },
  {
    method: 'POST',
    path: '/snapshots/runs',
    reason: 'Snapshot command creation is a mutation and is excluded from read capacity checks.',
  },
  {
    method: 'POST',
    path: '/checklists',
    reason: 'Checklist completion can create tasks and approvals; it is not part of this read-only harness.',
  },
]
