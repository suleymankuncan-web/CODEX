import { demoStoreId, demoEmployeeId, demoPositionId, outsideStoreId } from './store-surfaces-identities'

export const competitionFixture = {
  competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  competitionCode: 'APRIL_REGION_CHALLENGE',
  competitionName: 'April Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-04-22',
  endsOn: '2026-04-24',
}

export const targetDistributionRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 30,
    offset: 0,
  },
}

export const pendingTargetRequestId = '00000000-0000-4000-8000-000000000777'

export const pendingTargetDistributionRequestsFixture = {
  items: [
    {
      requestId: pendingTargetRequestId,
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi',
      totalTargetValue: 145000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: 'Magaza hedef dagitimi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 145000,
          note: null,
        },
      ],
      submittedByUserId: 'store-manager-1',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

export const targetCoverageFixture = {
  items: [
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: pendingTargetRequestId,
      pendingTargetValue: 145000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000203',
      displayName: 'Store Personnel Covered',
      externalEmployeeRef: 'FM8002',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 155000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000204',
      displayName: 'Store Personnel Missing',
      externalEmployeeRef: 'FM8003',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'missing',
    },
  ],
  meta: {
    count: 3,
    total: 3,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 3,
    coveredEmployees: 1,
    missingEmployees: 1,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 2,
    coverageRate: 1 / 3,
  },
}

export const storeTargetingPersonnelFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      netSalesValue: 145000,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

export const sellerCodeRequestFixture = {
  requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  storeType: 'franchise',
  requestType: 'create_code',
  status: 'pending_hr_approval',
  firstName: 'Ayse',
  lastName: 'Yilmaz',
  nationalIdLast4: '8901',
  phoneNumber: '05551234567',
  hireDate: '2026-05-01',
  requestedPositionId: demoPositionId,
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  employmentType: 'full_time',
  requestedSellerCode: null,
  approvedSellerCode: null,
  lastReferenceSellerCode: null,
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  employeeId: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

export const offboardingRequestFixture = {
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel',
  externalEmployeeRef: 'FM8001',
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  status: 'pending_hr_approval',
  terminationDate: '2026-05-10',
  terminationReason: 'resignation',
  requestReason: 'Personel istifa etti',
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

export const rejectedSellerCodeRequestFixture = {
  ...sellerCodeRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'TC numarasi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

export const outsideStoreSellerCodeRequestFixture = {
  ...sellerCodeRequestFixture,
  requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd90',
  storeId: outsideStoreId,
  storeCode: 'DEMO-999',
  storeName: 'Outside Store',
  firstName: 'Outside',
  lastName: 'Store',
  updatedAt: '2026-04-27T11:00:00.000Z',
}

export const outsideStoreRejectedSellerCodeRequestFixture = {
  ...outsideStoreSellerCodeRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T11:30:00.000Z',
  reviewNote: 'Outside store correction',
  updatedAt: '2026-04-27T11:30:00.000Z',
}

export const rejectedOffboardingRequestFixture = {
  ...offboardingRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'Cikis tarihi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

export const returnedOffboardingStatusFixture = {
  ...rejectedOffboardingRequestFixture,
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee80',
  employeeId: '00000000-0000-0000-0000-000000000208',
  displayName: 'Returned Offboarding Personnel',
  externalEmployeeRef: 'FM8008',
}

export const outsideStoreOffboardingRequestFixture = {
  ...offboardingRequestFixture,
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee90',
  storeId: outsideStoreId,
  storeCode: 'DEMO-999',
  storeName: 'Outside Store',
  employeeId: '00000000-0000-0000-0000-000000000909',
  displayName: 'Outside Personnel',
  externalEmployeeRef: 'FM9901',
  updatedAt: '2026-04-27T11:00:00.000Z',
}

export const outsideStoreRejectedOffboardingRequestFixture = {
  ...outsideStoreOffboardingRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T11:30:00.000Z',
  reviewNote: 'Outside offboarding correction',
  updatedAt: '2026-04-27T11:30:00.000Z',
}

export const storeEmployeesFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      storeId: demoStoreId,
      positionId: demoPositionId,
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      assignmentStartDate: '2026-04-01',
      employmentStatus: 'active',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 1,
    offset: 0,
  },
}

export const returnedOffboardingEmployeeFixture = {
  employeeId: '00000000-0000-0000-0000-000000000208',
  displayName: 'Returned Offboarding Personnel',
  externalEmployeeRef: 'FM8008',
  storeId: demoStoreId,
  positionId: demoPositionId,
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  assignmentStartDate: '2026-03-15',
  employmentStatus: 'active',
}

export const positionOptionsFixture = {
  items: [
    {
      positionId: demoPositionId,
      positionCode: 'SALES_ASSOCIATE',
      positionName: 'Sales Associate',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444443',
      positionCode: 'SALES',
      positionName: 'Sales',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444444',
      positionCode: 'ASSISTANT_MANAGER',
      positionName: 'Assistant Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444445',
      positionCode: 'SENIOR_SALES_CONSULTANT',
      positionName: 'Senior Sales Consultant',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444446',
      positionCode: 'CASHIER',
      positionName: 'Cashier',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444447',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
  ],
  meta: {
    count: 6,
    total: 6,
    limit: 6,
    offset: 0,
  },
}

export const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      competitionId: competitionFixture.competitionId,
      stageCode: 'QUALIFIER',
      stageName: 'Qualifier',
      stageOrder: 1,
      stageType: 'qualifier',
      startsOn: '2026-04-22',
      endsOn: '2026-04-24',
      lifecycleState: 'active',
      finalizationState: null,
    },
  ],
  teams: [
    {
      competitionTeamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId: demoStoreId,
          storeCode: 'DEMO-100',
          storeName: 'IstinyePark Demo Store',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      snapshotDate: '2026-04-22',
      scoreValue: 92.45,
      validStoreCount: 1,
      totalStoreCount: 1,
      coverageRate: 1,
      rankPosition: 1,
      rankingPopulation: 2,
    },
  ],
  warnings: [],
  storeContributions: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId: demoStoreId,
      storeCode: 'DEMO-100',
      storeName: 'IstinyePark Demo Store',
      regionId: '00000000-0000-0000-0000-000000000010',
      snapshotDate: '2026-04-22',
      scoreValue: 93.5,
      reportedWeightPercent: 95,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: ['BM_CHECKLIST'],
    },
  ],
}
