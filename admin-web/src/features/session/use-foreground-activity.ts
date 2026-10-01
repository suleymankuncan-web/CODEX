import { useEffect } from 'react'
import { sendOpenApiJson } from '../../lib/openapi-client'
import { listenForForegroundActivity } from './foreground-activity'

export function useForegroundActivity(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return
    return listenForForegroundActivity(() => sendOpenApiJson('/api/auth/activity', { method: 'POST' }))
  }, [userId])
}
