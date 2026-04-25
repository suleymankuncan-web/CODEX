import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PlusCircle } from 'lucide-react'
import {
  EmptyState,
  ScreenState,
  StatusPill,
} from '../../components/dashboard-primitives'
import { getAuthLookups, type AuthLookupStore } from '../auth/api'
import {
  createCompetitionStage,
  type CompetitionStageSummary,
  type CreateCompetitionStagePayload,
} from './api'
import { formatState, getErrorMessage } from '../../lib/format'

const codePattern = /^[A-Z0-9_]+$/
const stageTypeOptions: CompetitionStageSummary['stageType'][] = [
  'qualifier',
  'league',
  'quarter_final',
  'semi_final',
  'final',
  'custom',
]

type TeamDraft = {
  teamCode: string
  teamName: string
  storeIds: string[]
}

type StageDraft = {
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: TeamDraft[]
}

type StageBuilderFormProps = {
  competitionId: string
  competitionStartsOn: string
  competitionEndsOn: string
  onCreated: () => void | Promise<void>
}

function normalizeCode(value: string) {
  return value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')
}

function createInitialDraft(input: { startsOn: string; endsOn: string }): StageDraft {
  return {
    stageCode: 'QUALIFIER',
    stageName: 'Qualifier',
    stageOrder: '1',
    stageType: 'qualifier',
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    teams: [
      { teamCode: 'TEAM_A', teamName: 'Team A', storeIds: [] },
      { teamCode: 'TEAM_B', teamName: 'Team B', storeIds: [] },
    ],
  }
}

function storeLabel(store: AuthLookupStore) {
  return `${store.storeCode} - ${store.storeName} - ${store.regionName}`
}

function validateDraft(draft: StageDraft) {
  const stageOrder = Number(draft.stageOrder)

  if (!draft.stageCode.trim() || !codePattern.test(draft.stageCode)) {
    return 'Stage code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.stageName.trim()) {
    return 'Stage name is required.'
  }

  if (!Number.isInteger(stageOrder) || stageOrder < 1) {
    return 'Stage order must be 1 or higher.'
  }

  if (!draft.startsOn || !draft.endsOn || draft.endsOn < draft.startsOn) {
    return 'Stage date range must be valid.'
  }

  if (draft.teams.length < 2) {
    return 'At least two teams are required.'
  }

  const invalidTeam = draft.teams.find(
    (team) =>
      !team.teamCode.trim() ||
      !codePattern.test(team.teamCode) ||
      !team.teamName.trim() ||
      team.storeIds.length === 0,
  )

  if (invalidTeam) {
    return 'Every team needs a valid code, name, and at least one store.'
  }

  return null
}

export function StageBuilderForm(input: StageBuilderFormProps) {
  const [draft, setDraft] = useState(() =>
    createInitialDraft({ startsOn: input.competitionStartsOn, endsOn: input.competitionEndsOn }),
  )
  const [feedback, setFeedback] = useState<string | null>(null)

  const lookupsQuery = useQuery({
    queryKey: ['competition-stage-builder-lookups'],
    queryFn: getAuthLookups,
    staleTime: 60_000,
  })

  const stores = useMemo(
    () =>
      [...(lookupsQuery.data?.stores ?? [])].sort((left, right) =>
        storeLabel(left).localeCompare(storeLabel(right)),
      ),
    [lookupsQuery.data?.stores],
  )

  const validationMessage = validateDraft(draft)

  const createMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePayload) =>
      createCompetitionStage(input.competitionId, payload),
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await input.onCreated()
    },
  })

  function updateDraft(field: keyof Omit<StageDraft, 'teams'>, value: string) {
    setFeedback(null)
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateTeam(index: number, patch: Partial<TeamDraft>) {
    setFeedback(null)
    setDraft((current) => ({
      ...current,
      teams: current.teams.map((team, teamIndex) =>
        teamIndex === index ? { ...team, ...patch } : team,
      ),
    }))
  }

  function toggleStore(teamIndex: number, storeId: string) {
    const team = draft.teams[teamIndex]
    const nextStoreIds = team.storeIds.includes(storeId)
      ? team.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
      : [...team.storeIds, storeId]

    updateTeam(teamIndex, { storeIds: nextStoreIds })
  }

  function buildPayload(): CreateCompetitionStagePayload {
    return {
      stageCode: draft.stageCode.trim(),
      stageName: draft.stageName.trim(),
      stageOrder: Number(draft.stageOrder),
      stageType: draft.stageType,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      teams: draft.teams.map((team) => ({
        teamCode: team.teamCode.trim(),
        teamName: team.teamName.trim(),
        storeIds: team.storeIds,
      })),
    }
  }

  function submitStage() {
    const nextValidation = validateDraft(draft)
    if (nextValidation) return
    createMutation.mutate(buildPayload())
  }

  return (
    <section className="stacked-table" aria-label="Competition stage builder">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Stage Builder</div>
          <h3>Create stage</h3>
        </div>
        <StatusPill tone={validationMessage ? 'warning' : 'calm'}>
          {validationMessage ? 'Draft incomplete' : 'Ready'}
        </StatusPill>
      </div>

      <article className="stacked-row">
        <div className="form-grid">
          <label className="field-block">
            <span>Stage code</span>
            <input
              value={draft.stageCode}
              onChange={(event) => updateDraft('stageCode', normalizeCode(event.target.value))}
            />
          </label>
          <label className="field-block">
            <span>Stage name</span>
            <input
              value={draft.stageName}
              onChange={(event) => updateDraft('stageName', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage order</span>
            <input
              min="1"
              type="number"
              value={draft.stageOrder}
              onChange={(event) => updateDraft('stageOrder', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage type</span>
            <select
              value={draft.stageType}
              onChange={(event) =>
                updateDraft('stageType', event.target.value as CompetitionStageSummary['stageType'])
              }
            >
              {stageTypeOptions.map((stageType) => (
                <option key={stageType} value={stageType}>
                  {formatState(stageType)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>Stage starts</span>
            <input
              type="date"
              value={draft.startsOn}
              onChange={(event) => updateDraft('startsOn', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>Stage ends</span>
            <input
              type="date"
              value={draft.endsOn}
              onChange={(event) => updateDraft('endsOn', event.target.value)}
            />
          </label>
        </div>
      </article>

      {lookupsQuery.isLoading ? (
        <ScreenState title="Stores are loading" copy="Store options are loading for team assignment." />
      ) : null}

      {lookupsQuery.isError ? (
        <ScreenState
          title="Store options could not load"
          copy={getErrorMessage(lookupsQuery.error)}
          tone="error"
        />
      ) : null}

      {!lookupsQuery.isLoading && stores.length === 0 ? (
        <EmptyState title="No stores available" copy="Stage teams need at least one store." />
      ) : null}

      {draft.teams.map((team, teamIndex) => (
        <article className="stacked-row stage-builder-team" key={teamIndex}>
          <div className="stacked-row-head">
            <strong>{`Team ${teamIndex + 1}`}</strong>
            <StatusPill tone={team.storeIds.length > 0 ? 'accent' : 'warning'}>
              {`${team.storeIds.length} stores`}
            </StatusPill>
          </div>
          <div className="form-grid">
            <label className="field-block">
              <span>{`Team ${teamIndex + 1} code`}</span>
              <input
                value={team.teamCode}
                onChange={(event) =>
                  updateTeam(teamIndex, { teamCode: normalizeCode(event.target.value) })
                }
              />
            </label>
            <label className="field-block">
              <span>{`Team ${teamIndex + 1} name`}</span>
              <input
                value={team.teamName}
                onChange={(event) => updateTeam(teamIndex, { teamName: event.target.value })}
              />
            </label>
          </div>
          <div className="store-checkbox-grid">
            {stores.map((store) => (
              <label className="store-checkbox" key={`${teamIndex}-${store.storeId}`}>
                <input
                  type="checkbox"
                  checked={team.storeIds.includes(store.storeId)}
                  onChange={() => toggleStore(teamIndex, store.storeId)}
                />
                <span>{storeLabel(store)}</span>
              </label>
            ))}
          </div>
        </article>
      ))}

      {validationMessage ? <p className="validation-copy">{validationMessage}</p> : null}

      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(validationMessage) || createMutation.isPending || stores.length === 0}
          onClick={submitStage}
        >
          <PlusCircle size={16} />
          Create stage
        </button>
        <StatusPill tone="neutral">{`${draft.teams.length} teams`}</StatusPill>
      </div>

      {feedback ? <ScreenState title={feedback} copy="Stage detail is refreshed." /> : null}

      {createMutation.isError ? (
        <ScreenState
          title="Stage could not be created"
          copy={getErrorMessage(createMutation.error)}
          tone="error"
        />
      ) : null}
    </section>
  )
}
