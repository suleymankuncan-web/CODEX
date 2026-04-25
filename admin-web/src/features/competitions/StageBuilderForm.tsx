import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusCircle } from 'lucide-react'
import {
  EmptyState,
  ScreenState,
  StatusPill,
} from '../../components/dashboard-primitives'
import { getAuthLookups, type AuthLookupStore } from '../auth/api'
import {
  cloneCompetitionTeamTemplate,
  createCompetitionTeamTemplate,
  createCompetitionStage,
  createCompetitionStagePackage,
  deactivateCompetitionTeamTemplate,
  listCompetitionTeamTemplates,
  updateCompetitionTeamTemplate,
  type CloneCompetitionTeamTemplatePayload,
  type CompetitionStagePackageCode,
  type CompetitionTeamTemplate,
  type CompetitionStageSummary,
  type CreateCompetitionStagePackagePayload,
  type CreateCompetitionTeamTemplatePayload,
  type CreateCompetitionStagePayload,
  type UpdateCompetitionTeamTemplatePayload,
} from './api'
import {
  buildStagePackagePayload,
  stagePackageOptions,
} from './stage-packages'
import {
  buildStagePresetDraft,
  stagePresetOptions,
  type StagePresetCode,
} from './stage-presets'
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
  sourceTemplateId?: string
  storeIds: string[]
}

type TemplateDraft = {
  templateCode: string
  templateName: string
  description: string
  storeIds: string[]
}

type TemplateEditDraft = TemplateDraft & {
  templateId: string
}

type TemplateCloneDraft = Omit<TemplateDraft, 'storeIds'> & {
  sourceTemplateId: string
}

type StageDraft = {
  stagePresetCode?: StagePresetCode
  stageCode: string
  stageName: string
  stageOrder: string
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: TeamDraft[]
}

type StagePackageDraft = {
  packageCode: CompetitionStagePackageCode
  firstTemplateId: string
  secondTemplateId: string
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

function createInitialTemplateDraft(): TemplateDraft {
  return {
    templateCode: '',
    templateName: '',
    description: '',
    storeIds: [],
  }
}

function createTemplateEditDraft(template: CompetitionTeamTemplate): TemplateEditDraft {
  return {
    templateId: template.templateId,
    templateCode: template.templateCode,
    templateName: template.templateName,
    description: template.description ?? '',
    storeIds: template.stores.map((store) => store.storeId),
  }
}

function createTemplateCloneDraft(template: CompetitionTeamTemplate): TemplateCloneDraft {
  return {
    sourceTemplateId: template.templateId,
    templateCode: normalizeCode(`${template.templateCode}_COPY`),
    templateName: `${template.templateName} Copy`,
    description: template.description ?? '',
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

function validateStagePackageDraft(
  draft: StagePackageDraft,
  templates: CompetitionTeamTemplate[],
) {
  if (!draft.packageCode) {
    return 'Stage package is required.'
  }

  if (!draft.firstTemplateId || !draft.secondTemplateId) {
    return 'Stage package needs two active team templates.'
  }

  if (draft.firstTemplateId === draft.secondTemplateId) {
    return 'Stage package team templates must be different.'
  }

  const selectedTemplates = templates.filter((template) =>
    [draft.firstTemplateId, draft.secondTemplateId].includes(template.templateId),
  )

  if (selectedTemplates.length !== 2) {
    return 'Stage package templates must be active.'
  }

  if (selectedTemplates.some((template) => template.stores.length === 0)) {
    return 'Stage package templates need at least one store.'
  }

  return null
}

function validateTemplateDraft(draft: TemplateDraft) {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'Template code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.templateName.trim()) {
    return 'Template name is required.'
  }

  if (draft.storeIds.length === 0) {
    return 'Template needs at least one store.'
  }

  return null
}

function validateTemplateCloneDraft(draft: TemplateCloneDraft) {
  if (!draft.templateCode.trim() || !codePattern.test(draft.templateCode)) {
    return 'Template code must use uppercase letters, numbers, and underscores.'
  }

  if (!draft.templateName.trim()) {
    return 'Template name is required.'
  }

  return null
}

export function StageBuilderForm(input: StageBuilderFormProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() =>
    createInitialDraft({ startsOn: input.competitionStartsOn, endsOn: input.competitionEndsOn }),
  )
  const [stagePackageDraft, setStagePackageDraft] = useState<StagePackageDraft>({
    packageCode: 'league_then_final',
    firstTemplateId: '',
    secondTemplateId: '',
  })
  const [templateDraft, setTemplateDraft] = useState(createInitialTemplateDraft)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [stagePackageFeedback, setStagePackageFeedback] = useState<string | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null)
  const [templateLifecycleFeedback, setTemplateLifecycleFeedback] = useState<string | null>(null)
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false)

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

  const templatesQuery = useQuery({
    queryKey: ['competition-team-templates', 'active'],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: true }),
    staleTime: 60_000,
  })

  const templateLibraryQuery = useQuery({
    queryKey: ['competition-team-templates', 'library', showInactiveTemplates],
    queryFn: () => listCompetitionTeamTemplates({ activeOnly: !showInactiveTemplates }),
    staleTime: 60_000,
  })

  const templates = useMemo(
    () =>
      [...(templatesQuery.data?.items ?? [])].sort((left, right) =>
        left.templateCode.localeCompare(right.templateCode),
      ),
    [templatesQuery.data?.items],
  )

  const validationMessage = validateDraft(draft)
  const stagePackageValidationMessage = validateStagePackageDraft(stagePackageDraft, templates)
  const templateValidationMessage = validateTemplateDraft(templateDraft)

  const createMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePayload) =>
      createCompetitionStage(input.competitionId, payload),
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await input.onCreated()
    },
  })

  const createStagePackageMutation = useMutation({
    mutationFn: (payload: CreateCompetitionStagePackagePayload) =>
      createCompetitionStagePackage(input.competitionId, payload),
    onSuccess: async (response) => {
      setStagePackageFeedback(response.command.message)
      await input.onCreated()
    },
  })

  const createTemplateMutation = useMutation({
    mutationFn: (payload: CreateCompetitionTeamTemplatePayload) =>
      createCompetitionTeamTemplate(payload),
    onSuccess: async (response) => {
      setTemplateFeedback(response.command.message)
      setTemplateDraft(createInitialTemplateDraft())
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const deactivateTemplateMutation = useMutation({
    mutationFn: deactivateCompetitionTeamTemplate,
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: UpdateCompetitionTeamTemplatePayload
    }) => updateCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  const cloneTemplateMutation = useMutation({
    mutationFn: (request: {
      templateId: string
      payload: CloneCompetitionTeamTemplatePayload
    }) => cloneCompetitionTeamTemplate(request.templateId, request.payload),
    onSuccess: async (response) => {
      setTemplateLifecycleFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['competition-team-templates'] })
    },
  })

  function updateDraft(field: keyof Omit<StageDraft, 'teams'>, value: string) {
    setFeedback(null)
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function applyStagePreset(presetCode: string) {
    setFeedback(null)

    if (!presetCode) {
      setDraft((current) => ({ ...current, stagePresetCode: undefined }))
      return
    }

    const presetDraft = buildStagePresetDraft({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      presetCode: presetCode as StagePresetCode,
    })

    if (!presetDraft) return

    setDraft((current) => ({
      ...current,
      ...presetDraft,
    }))
  }

  function updateStagePackageDraft(field: keyof StagePackageDraft, value: string) {
    setStagePackageFeedback(null)
    setStagePackageDraft((current) => ({ ...current, [field]: value }))
  }

  function getSelectedStagePackageTemplates() {
    return [
      templates.find((template) => template.templateId === stagePackageDraft.firstTemplateId),
      templates.find((template) => template.templateId === stagePackageDraft.secondTemplateId),
    ].filter((template): template is CompetitionTeamTemplate => Boolean(template))
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

  function updateTemplateDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    setTemplateFeedback(null)
    setTemplateDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleStore(teamIndex: number, storeId: string) {
    const team = draft.teams[teamIndex]
    const nextStoreIds = team.storeIds.includes(storeId)
      ? team.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
      : [...team.storeIds, storeId]

    updateTeam(teamIndex, { storeIds: nextStoreIds })
  }

  function toggleTemplateStore(storeId: string) {
    setTemplateFeedback(null)
    setTemplateDraft((current) => ({
      ...current,
      storeIds: current.storeIds.includes(storeId)
        ? current.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
        : [...current.storeIds, storeId],
    }))
  }

  function applyTemplate(teamIndex: number, templateId: string) {
    const template = templates.find((item) => item.templateId === templateId)

    if (!template) {
      updateTeam(teamIndex, { sourceTemplateId: undefined })
      return
    }

    updateTeam(teamIndex, {
      sourceTemplateId: template.templateId,
      teamCode: normalizeCode(template.templateCode),
      teamName: template.templateName,
      storeIds: template.stores.map((store) => store.storeId),
    })
  }

  function buildPayload(): CreateCompetitionStagePayload {
    return {
      ...(draft.stagePresetCode ? { stagePresetCode: draft.stagePresetCode } : {}),
      stageCode: draft.stageCode.trim(),
      stageName: draft.stageName.trim(),
      stageOrder: Number(draft.stageOrder),
      stageType: draft.stageType,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      teams: draft.teams.map((team) => {
        const teamPayload = {
          teamCode: team.teamCode.trim(),
          teamName: team.teamName.trim(),
          storeIds: team.storeIds,
        }

        return team.sourceTemplateId
          ? { ...teamPayload, sourceTemplateId: team.sourceTemplateId }
          : teamPayload
      }),
    }
  }

  function buildTemplatePayload(): CreateCompetitionTeamTemplatePayload {
    return {
      templateCode: templateDraft.templateCode.trim(),
      templateName: templateDraft.templateName.trim(),
      description: templateDraft.description.trim() || undefined,
      storeIds: templateDraft.storeIds,
    }
  }

  function submitStage() {
    const nextValidation = validateDraft(draft)
    if (nextValidation) return
    createMutation.mutate(buildPayload())
  }

  function submitTemplate() {
    const nextValidation = validateTemplateDraft(templateDraft)
    if (nextValidation) return
    createTemplateMutation.mutate(buildTemplatePayload())
  }

  function submitStagePackage() {
    const nextValidation = validateStagePackageDraft(stagePackageDraft, templates)
    if (nextValidation) return

    const payload = buildStagePackagePayload({
      competitionStartsOn: input.competitionStartsOn,
      competitionEndsOn: input.competitionEndsOn,
      packageCode: stagePackageDraft.packageCode,
      templates: getSelectedStagePackageTemplates(),
    })

    if (!payload) return

    createStagePackageMutation.mutate(payload)
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
            <span>Stage preset</span>
            <select
              value={draft.stagePresetCode ?? ''}
              onChange={(event) => applyStagePreset(event.target.value)}
            >
              <option value="">Manual stage</option>
              {stagePresetOptions.map((preset) => (
                <option key={preset.code} value={preset.code}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
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

      <TemplateBuilderSection
        draft={templateDraft}
        error={createTemplateMutation.error}
        feedback={templateFeedback}
        isPending={createTemplateMutation.isPending}
        stores={stores}
        validationMessage={templateValidationMessage}
        onSubmit={submitTemplate}
        onToggleStore={toggleTemplateStore}
        onUpdate={updateTemplateDraft}
      />

      <TemplateLibrarySection
        error={
          templateLibraryQuery.error ??
          deactivateTemplateMutation.error ??
          updateTemplateMutation.error ??
          cloneTemplateMutation.error
        }
        feedback={templateLifecycleFeedback}
        isLoading={templateLibraryQuery.isLoading}
        isPending={
          deactivateTemplateMutation.isPending ||
          updateTemplateMutation.isPending ||
          cloneTemplateMutation.isPending
        }
        showInactive={showInactiveTemplates}
        stores={stores}
        templates={templateLibraryQuery.data?.items ?? []}
        onClone={(templateId, payload) =>
          cloneTemplateMutation.mutate({ templateId, payload })
        }
        onDeactivate={(templateId) => deactivateTemplateMutation.mutate(templateId)}
        onShowInactiveChange={setShowInactiveTemplates}
        onUpdate={(templateId, payload) =>
          updateTemplateMutation.mutate({ templateId, payload })
        }
      />

      {templatesQuery.isError ? (
        <ScreenState
          title="Team templates could not load"
          copy={getErrorMessage(templatesQuery.error)}
          tone="error"
        />
      ) : null}

      <StagePackageBuilderSection
        draft={stagePackageDraft}
        error={createStagePackageMutation.error}
        feedback={stagePackageFeedback}
        isPending={createStagePackageMutation.isPending}
        templates={templates}
        validationMessage={stagePackageValidationMessage}
        onSubmit={submitStagePackage}
        onUpdate={updateStagePackageDraft}
      />

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
              <span>{`Team ${teamIndex + 1} template`}</span>
              <select
                value={team.sourceTemplateId ?? ''}
                onChange={(event) => applyTemplate(teamIndex, event.target.value)}
              >
                <option value="">Manual team</option>
                {templates.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.templateCode} - {template.templateName}
                  </option>
                ))}
              </select>
            </label>
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

function StagePackageBuilderSection(input: {
  draft: StagePackageDraft
  error: unknown
  feedback: string | null
  isPending: boolean
  templates: CompetitionTeamTemplate[]
  validationMessage: string | null
  onSubmit: () => void
  onUpdate: (field: keyof StagePackageDraft, value: string) => void
}) {
  return (
    <article className="stacked-row stage-package-builder">
      <div className="stacked-row-head">
        <div>
          <strong>Stage package</strong>
          <p className="queue-subtitle">Create the league and final stages from active templates.</p>
        </div>
        <StatusPill tone={input.validationMessage ? 'warning' : 'calm'}>
          {input.validationMessage ? 'Package incomplete' : 'Ready'}
        </StatusPill>
      </div>

      <div className="form-grid">
        <label className="field-block">
          <span>Stage package</span>
          <select
            value={input.draft.packageCode}
            onChange={(event) => input.onUpdate('packageCode', event.target.value)}
          >
            {stagePackageOptions.map((packageOption) => (
              <option key={packageOption.code} value={packageOption.code}>
                {packageOption.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>Package team 1 template</span>
          <select
            value={input.draft.firstTemplateId}
            onChange={(event) => input.onUpdate('firstTemplateId', event.target.value)}
          >
            <option value="">Select template</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span>Package team 2 template</span>
          <select
            value={input.draft.secondTemplateId}
            onChange={(event) => input.onUpdate('secondTemplateId', event.target.value)}
          >
            <option value="">Select template</option>
            {input.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateCode} - {template.templateName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {input.validationMessage ? (
        <p className="validation-copy">{input.validationMessage}</p>
      ) : null}

      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending}
          onClick={input.onSubmit}
        >
          <PlusCircle size={16} />
          Create stage package
        </button>
        <StatusPill tone="neutral">2 stages</StatusPill>
      </div>

      {input.feedback ? (
        <ScreenState title={input.feedback} copy="Competition detail is refreshed." />
      ) : null}

      {input.error ? (
        <ScreenState
          title="Stage package could not be created"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}

function TemplateLibrarySection(input: {
  error: unknown
  feedback: string | null
  isLoading: boolean
  isPending: boolean
  showInactive: boolean
  stores: AuthLookupStore[]
  templates: CompetitionTeamTemplate[]
  onClone: (templateId: string, payload: CloneCompetitionTeamTemplatePayload) => void
  onDeactivate: (templateId: string) => void
  onShowInactiveChange: (value: boolean) => void
  onUpdate: (templateId: string, payload: UpdateCompetitionTeamTemplatePayload) => void
}) {
  const [editDraft, setEditDraft] = useState<TemplateEditDraft | null>(null)
  const [cloneDraft, setCloneDraft] = useState<TemplateCloneDraft | null>(null)
  const editValidationMessage = editDraft ? validateTemplateDraft(editDraft) : null
  const cloneValidationMessage = cloneDraft ? validateTemplateCloneDraft(cloneDraft) : null

  function updateEditDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function toggleEditStore(storeId: string) {
    setEditDraft((current) => {
      if (!current) return current

      return {
        ...current,
        storeIds: current.storeIds.includes(storeId)
          ? current.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
          : [...current.storeIds, storeId],
      }
    })
  }

  function submitEditDraft() {
    if (!editDraft || validateTemplateDraft(editDraft)) return

    input.onUpdate(editDraft.templateId, {
      templateCode: editDraft.templateCode.trim(),
      templateName: editDraft.templateName.trim(),
      description: editDraft.description.trim() || undefined,
      storeIds: editDraft.storeIds,
    })
    setEditDraft(null)
  }

  function updateCloneDraft(field: keyof Omit<TemplateCloneDraft, 'sourceTemplateId'>, value: string) {
    setCloneDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function submitCloneDraft() {
    if (!cloneDraft || validateTemplateCloneDraft(cloneDraft)) return

    input.onClone(cloneDraft.sourceTemplateId, {
      templateCode: cloneDraft.templateCode.trim(),
      templateName: cloneDraft.templateName.trim(),
      description: cloneDraft.description.trim() || undefined,
    })
    setCloneDraft(null)
  }

  return (
    <article className="stacked-row stage-template-library">
      <div className="stacked-row-head">
        <div>
          <strong>Template library</strong>
          <p className="queue-subtitle">Active templates feed stage team selection.</p>
        </div>
        <StatusPill tone={input.showInactive ? 'accent' : 'neutral'}>
          {input.showInactive ? 'All templates' : 'Active only'}
        </StatusPill>
      </div>
      <label className="store-checkbox template-toggle">
        <input
          type="checkbox"
          checked={input.showInactive}
          onChange={(event) => input.onShowInactiveChange(event.target.checked)}
        />
        <span>Show inactive templates</span>
      </label>

      {input.isLoading ? (
        <ScreenState title="Templates are loading" copy="Reusable team templates are loading." />
      ) : null}

      {!input.isLoading && input.templates.length === 0 ? (
        <EmptyState title="No templates" copy="Created templates appear in this library." />
      ) : null}

      {input.templates.length > 0 ? (
        <div className="stacked-table">
          {input.templates.map((template) => (
            <article className="stacked-row" key={template.templateId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{template.templateCode}</strong>
                  <p className="queue-subtitle">{template.templateName}</p>
                </div>
                <StatusPill tone={template.isActive ? 'calm' : 'neutral'}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </StatusPill>
              </div>
              <div className="key-grid">
                <div className="key-item">
                  <span>Stores</span>
                  <strong>{String(template.stores.length)}</strong>
                </div>
                <div className="key-item">
                  <span>Description</span>
                  <strong>{template.description ?? '-'}</strong>
                </div>
              </div>

              {editDraft?.templateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>Edit template code</span>
                      <input
                        value={editDraft.templateCode}
                        onChange={(event) =>
                          updateEditDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>Edit template name</span>
                      <input
                        value={editDraft.templateName}
                        onChange={(event) => updateEditDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>Edit template description</span>
                      <input
                        value={editDraft.description}
                        onChange={(event) => updateEditDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="store-checkbox-grid">
                    {input.stores.map((store) => (
                      <label className="store-checkbox" key={`edit-${template.templateId}-${store.storeId}`}>
                        <input
                          type="checkbox"
                          checked={editDraft.storeIds.includes(store.storeId)}
                          onChange={() => toggleEditStore(store.storeId)}
                        />
                        <span>{storeLabel(store)}</span>
                      </label>
                    ))}
                  </div>
                  {editValidationMessage ? (
                    <p className="validation-copy">{editValidationMessage}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(editValidationMessage) || input.isPending}
                      onClick={submitEditDraft}
                    >
                      Save template
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setEditDraft(null)}
                    >
                      Cancel edit
                    </button>
                  </div>
                </div>
              ) : null}

              {cloneDraft?.sourceTemplateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>Clone template code</span>
                      <input
                        value={cloneDraft.templateCode}
                        onChange={(event) =>
                          updateCloneDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>Clone template name</span>
                      <input
                        value={cloneDraft.templateName}
                        onChange={(event) => updateCloneDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>Clone template description</span>
                      <input
                        value={cloneDraft.description}
                        onChange={(event) => updateCloneDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  {cloneValidationMessage ? (
                    <p className="validation-copy">{cloneValidationMessage}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(cloneValidationMessage) || input.isPending}
                      onClick={submitCloneDraft}
                    >
                      Clone template
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setCloneDraft(null)}
                    >
                      Cancel clone
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="action-cluster">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setCloneDraft(null)
                    setEditDraft(createTemplateEditDraft(template))
                  }}
                >
                  Edit {template.templateCode}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setEditDraft(null)
                    setCloneDraft(createTemplateCloneDraft(template))
                  }}
                >
                  Clone {template.templateCode}
                </button>
                {template.isActive ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onDeactivate(template.templateId)}
                  >
                    Deactivate {template.templateCode}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {input.feedback ? (
        <ScreenState title={input.feedback} copy="Template library is refreshed." />
      ) : null}

      {input.error ? (
        <ScreenState
          title="Template library action failed"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}

function TemplateBuilderSection(input: {
  draft: TemplateDraft
  error: unknown
  feedback: string | null
  isPending: boolean
  stores: AuthLookupStore[]
  validationMessage: string | null
  onSubmit: () => void
  onToggleStore: (storeId: string) => void
  onUpdate: (field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) => void
}) {
  return (
    <article className="stacked-row stage-template-builder">
      <div className="stacked-row-head">
        <div>
          <strong>Team template</strong>
          <p className="queue-subtitle">Reusable store groups for future stages.</p>
        </div>
        <StatusPill tone={input.draft.storeIds.length > 0 ? 'accent' : 'warning'}>
          {`${input.draft.storeIds.length} stores`}
        </StatusPill>
      </div>
      <div className="form-grid">
        <label className="field-block">
          <span>Template code</span>
          <input
            value={input.draft.templateCode}
            onChange={(event) => input.onUpdate('templateCode', normalizeCode(event.target.value))}
          />
        </label>
        <label className="field-block">
          <span>Template name</span>
          <input
            value={input.draft.templateName}
            onChange={(event) => input.onUpdate('templateName', event.target.value)}
          />
        </label>
        <label className="field-block field-block-full">
          <span>Template description</span>
          <input
            value={input.draft.description}
            onChange={(event) => input.onUpdate('description', event.target.value)}
          />
        </label>
      </div>
      <div className="store-checkbox-grid">
        {input.stores.map((store) => (
          <label className="store-checkbox" key={`template-${store.storeId}`}>
            <input
              type="checkbox"
              checked={input.draft.storeIds.includes(store.storeId)}
              onChange={() => input.onToggleStore(store.storeId)}
            />
            <span>{storeLabel(store)}</span>
          </label>
        ))}
      </div>
      {input.validationMessage ? (
        <p className="validation-copy">{input.validationMessage}</p>
      ) : null}
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending || input.stores.length === 0}
          onClick={input.onSubmit}
        >
          <PlusCircle size={16} />
          Create template
        </button>
      </div>
      {input.feedback ? <ScreenState title={input.feedback} copy="Template list is refreshed." /> : null}
      {input.error ? (
        <ScreenState
          title="Template could not be created"
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}
