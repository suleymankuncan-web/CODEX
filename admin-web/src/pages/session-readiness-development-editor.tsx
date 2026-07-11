import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { KeyValue, StatusPill } from '../components/dashboard-primitives'
import { Button } from '../components/ui/button'
import { useLocalization } from '../features/localization/useLocalization'
import {
  isCookieBrowserSession,
  type SessionState,
} from '../features/session/session-storage'

export function SessionReadinessDevelopmentEditor(input: {
  draft: SessionState
  isReady: boolean
  session: SessionState
  setDraft: Dispatch<SetStateAction<SessionState>>
  onSave: () => void
  onVerify: () => void
  onReset: () => void
}) {
  const { t } = useLocalization()
  const mode = input.draft.mode
  const requestPreview = useMemo(() => {
    if (mode === 'bearer') {
      if (isCookieBrowserSession(input.draft)) {
        return [
          { label: 'Cookie', value: t('sessionReadiness.cookieSessionPreview') },
          { label: 'X-CSRF-Token', value: t('sessionReadiness.csrfMemoryPreview') },
        ]
      }

      return input.draft.bearerToken
        ? [{ label: 'Authorization', value: `Bearer ${truncateToken(input.draft.bearerToken)}` }]
        : [{ label: 'Authorization', value: t('sessionReadiness.noTokenSetYet') }]
    }

    return [
      { label: 'x-user-id', value: input.draft.mockUserId },
      { label: 'x-role-codes', value: input.draft.mockRoleCodes },
      { label: 'x-company-ids', value: input.draft.mockCompanyIds },
      { label: 'x-store-ids', value: input.draft.mockStoreIds || '-' },
      { label: 'x-read-store-ids', value: input.draft.mockReadStoreIds || '-' },
      { label: 'x-assigned-store-ids', value: input.draft.mockAssignedStoreIds || '-' },
      { label: 'x-region-ids', value: input.draft.mockRegionIds || '-' },
      { label: 'x-read-region-ids', value: input.draft.mockReadRegionIds || '-' },
    ]
  }, [input.draft, mode, t])

  return (
    <>
      <article className="panel" data-testid="session-development-editor">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('sessionReadiness.sessionMode')}</div>
            <h3>{t('sessionReadiness.sessionModeTitle')}</h3>
          </div>
          <StatusPill tone={input.isReady ? 'calm' : 'warning'}>
            {input.isReady ? t('sessionReadiness.ready') : t('sessionReadiness.needsSetup')}
          </StatusPill>
        </div>

        <div className="toolbar-cluster">
          <button
            className={`segmented-button${mode === 'mock' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => input.setDraft((current) => ({ ...current, mode: 'mock' }))}
          >
            {t('sessionReadiness.mockHeaders')}
          </button>
          <button
            className={`segmented-button${mode === 'bearer' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => input.setDraft((current) => ({ ...current, mode: 'bearer' }))}
          >
            {t('sessionReadiness.bearerToken')}
          </button>
        </div>

        {mode === 'mock' ? (
          <div className="form-grid">
            <label className="field-block">
              <span>{t('sessionReadiness.userId')}</span>
              <input
                value={input.draft.mockUserId}
                onChange={(event) =>
                  input.setDraft((current) => ({ ...current, mockUserId: event.target.value }))
                }
              />
            </label>
            <label className="field-block">
              <span>{t('sessionReadiness.companyIds')}</span>
              <input
                value={input.draft.mockCompanyIds}
                onChange={(event) =>
                  input.setDraft((current) => ({ ...current, mockCompanyIds: event.target.value }))
                }
              />
            </label>
            <label className="field-block field-block-full">
              <span>{t('sessionReadiness.roleCodes')}</span>
              <input
                value={input.draft.mockRoleCodes}
                onChange={(event) =>
                  input.setDraft((current) => ({ ...current, mockRoleCodes: event.target.value }))
                }
              />
            </label>
            <label className="field-block">
              <span>x-store-ids</span>
              <input
                value={input.draft.mockStoreIds}
                onChange={(event) =>
                  input.setDraft((current) => ({ ...current, mockStoreIds: event.target.value }))
                }
              />
            </label>
            <label className="field-block">
              <span>x-assigned-store-ids</span>
              <input
                value={input.draft.mockAssignedStoreIds}
                onChange={(event) =>
                  input.setDraft((current) => ({
                    ...current,
                    mockAssignedStoreIds: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-block">
              <span>x-read-store-ids</span>
              <input
                value={input.draft.mockReadStoreIds}
                onChange={(event) =>
                  input.setDraft((current) => ({
                    ...current,
                    mockReadStoreIds: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-block">
              <span>x-region-ids</span>
              <input
                value={input.draft.mockRegionIds}
                onChange={(event) =>
                  input.setDraft((current) => ({ ...current, mockRegionIds: event.target.value }))
                }
              />
            </label>
            <label className="field-block field-block-full">
              <span>x-read-region-ids</span>
              <input
                value={input.draft.mockReadRegionIds}
                onChange={(event) =>
                  input.setDraft((current) => ({
                    ...current,
                    mockReadRegionIds: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ) : (
          <label className="field-block">
            <span>{t('sessionReadiness.bearerToken')}</span>
            <textarea
              className="field-textarea"
              value={input.draft.bearerToken}
              onChange={(event) =>
                input.setDraft((current) => ({ ...current, bearerToken: event.target.value }))
              }
              placeholder={t('sessionReadiness.bearerPlaceholder')}
            />
          </label>
        )}

        <div className="action-cluster">
          <Button type="button" onClick={input.onSave}>
            {t('sessionReadiness.saveSession')}
          </Button>
          <Button
            type="button"
            onClick={input.onVerify}
            disabled={!input.isReady}
            variant="outline"
          >
            {t('sessionReadiness.verifyCurrentSession')}
          </Button>
          <Button type="button" onClick={input.onReset} variant="outline">
            {t('sessionReadiness.resetToDefaults')}
          </Button>
        </div>
      </article>

      <article className="panel" data-testid="session-development-preview">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('sessionReadiness.requestPreview')}</div>
            <h3>{t('sessionReadiness.requestPreviewTitle')}</h3>
          </div>
        </div>

        <div className="key-grid">
          {requestPreview.map((item) => (
            <KeyValue key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="stacked-table">
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{t('sessionReadiness.mockMode')}</strong>
              <StatusPill tone={input.session.mode === 'mock' ? 'accent' : 'neutral'}>
                {t('sessionReadiness.dev')}
              </StatusPill>
            </div>
            <p>{t('sessionReadiness.mockModeCopy')}</p>
          </div>
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{t('sessionReadiness.bearerMode')}</strong>
              <StatusPill tone={input.session.mode === 'bearer' ? 'accent' : 'neutral'}>
                {t('sessionReadiness.prodPath')}
              </StatusPill>
            </div>
            <p>{t('sessionReadiness.bearerModeCopy')}</p>
            {isCookieBrowserSession(input.session) ? (
              <p>{t('sessionReadiness.cookieTransportCopy')}</p>
            ) : null}
          </div>
        </div>
      </article>
    </>
  )
}

function truncateToken(token: string) {
  const normalized = token.trim()

  if (normalized.length < 18) {
    return '[redacted]'
  }

  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`
}
