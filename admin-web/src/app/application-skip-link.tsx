import { useLocalization } from '../features/localization/useLocalization'

export const applicationMainContentId = 'application-main-content'

export function ApplicationSkipLink() {
  const { t } = useLocalization()

  function focusMainContent() {
    window.requestAnimationFrame(() => {
      document.getElementById(applicationMainContentId)?.focus()
    })
  }

  return (
    <a
      className="application-skip-link"
      href={`#${applicationMainContentId}`}
      onClick={focusMainContent}
    >
      {t('adminShell.skipToMain')}
    </a>
  )
}
