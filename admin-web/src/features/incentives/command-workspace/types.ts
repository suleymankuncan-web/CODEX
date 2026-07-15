import type { components } from '@/generated/openapi-types'

type GeneratedWorkspace = components['schemas']['SalesTargetIncentiveWorkspace']

export type IncentiveWorkspace = GeneratedWorkspace & {
  sections: {
    core: { status: 'complete' | 'unavailable' }
    storeMetadata: { status: 'complete' | 'unavailable' }
    rateMetadata: { status: 'complete' | 'unavailable' }
    correctionActors: { status: 'complete' | 'unavailable' }
  }
}

export type IncentiveRegion = IncentiveWorkspace['regions'][number]
export type IncentiveStore = IncentiveRegion['stores'][number]
export type IncentiveRow = IncentiveStore['rows'][number]
export type IncentiveStatusFilter = 'all' | 'pending_review' | 'reviewed' | 'corrected' | 'earning'
