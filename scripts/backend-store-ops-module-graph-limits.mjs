// Exact bounded ownership limits consumed by the canonical architecture guard.
export const storeOpsModuleGraphLimits = new Map([
  // Group existing cache/returns read ownership without growing the ranking service graph.
  ['backend/nestjs/src/modules/store-ops/store-ops-ranking-read-dependencies.module.ts', { imports: 2, controllers: 0, providers: 0, exports: 2 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-personnel-correction.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops.module.ts', { controllers: 0, providers: 0, exports: 5 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-checklist.module.ts',
    { controllers: 3, providers: 4, exports: 1 },
  ],
  ['backend/nestjs/src/modules/store-ops/store-ops-checklist-command.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-checklist-history.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-checklist-visit-plan.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-photo-media.module.ts', { imports: 1, controllers: 1, providers: 10, exports: 1 }], ['backend/nestjs/src/modules/store-ops/store-ops-photo-media-retention.module.ts', { providers: 2, exports: 1 }],
  // PR10 adds one isolated Region Manager advisory controller plus its service/repository.
  ['backend/nestjs/src/modules/store-ops/store-ops-vm-reference.module.ts', { imports: 1, controllers: 3, providers: 6, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-store-action.module.ts', { imports: 1, controllers: 1, providers: 5, exports: 2 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-competition.module.ts', { controllers: 1, providers: 6, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive.module.ts', { controllers: 2, providers: 6, exports: 1 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-incentive-approval.module.ts',
    { controllers: 0, providers: 1, exports: 1 },
  ],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-admin-package-read.module.ts', { controllers: 0, providers: 1, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-manager-package.module.ts', { controllers: 0, providers: 2, exports: 2 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-package-data.module.ts', { imports: 3, controllers: 0, providers: 0, exports: 3 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-admin-package-workflow.module.ts', { imports: 2, controllers: 0, providers: 1, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-final-approval.module.ts', { imports: 1, controllers: 1, providers: 0, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-hr-handoff.module.ts', { controllers: 1, providers: 3, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-projection.module.ts', { controllers: 0, providers: 3, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-workflow.module.ts', { imports: 2, controllers: 0, providers: 1, exports: 1 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-returns-read.module.ts', { imports: 0, controllers: 1, providers: 3, exports: 1 }], ['backend/nestjs/src/modules/store-ops/store-ops-incentive-workspace-data.module.ts', { imports: 2, controllers: 0, providers: 0, exports: 2 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-workspace.module.ts', { imports: 1, controllers: 1, providers: 3, exports: 0 }],
  // Participation writes have their own two-provider boundary; the read workspace budget stays frozen.
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-participation.module.ts', { imports: 1, controllers: 0, providers: 2, exports: 2 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-incentive-company-cycle.module.ts', { imports: 0, controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-target-workspace.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-task-command-read.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-reporting.module.ts',
    { controllers: 0, providers: 0, exports: 5 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-org.module.ts',
    { controllers: 1, providers: 2, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-region-manager-directory.module.ts',
    { controllers: 1, providers: 2, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-workforce.module.ts',
    { controllers: 1, providers: 3, exports: 1 },
  ],
  ['backend/nestjs/src/modules/store-ops/store-ops-no-positive-sales-alert.module.ts', { controllers: 0, providers: 3, exports: 0 }],
  ['backend/nestjs/src/modules/store-ops/store-ops-workforce-workspace-read.module.ts', { controllers: 1, providers: 2, exports: 0 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-snapshot.module.ts',
    { controllers: 1, providers: 4, exports: 2 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-ranking.module.ts',
    { imports: 1, controllers: 0, providers: 8, exports: 3 },
  ],
  // Redis lifecycle belongs to the ranking-only cache module, never the global/shared module.
  ['backend/nestjs/src/modules/store-ops/store-ops-ranking-cache.module.ts', { controllers: 0, providers: 1, exports: 1 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-reporting-read.module.ts',
    { controllers: 1, providers: 8, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-report-package-read.module.ts',
    { controllers: 1, providers: 3, exports: 0 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-targets.module.ts',
    { imports: 1, controllers: 4, providers: 11, exports: 4 },
  ],
])
