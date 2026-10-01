export function listenForForegroundActivity(send: () => Promise<unknown>, targetWindow: Window = window, targetDocument: Document = document) {
  let lastAttempt = -Infinity
  let disposed = false
  const signal = (event: Event) => {
    if (!event.isTrusted || disposed || targetDocument.visibilityState !== 'visible' || !targetDocument.hasFocus()) return
    const now = Date.now()
    if (now - lastAttempt < 120_000) return
    lastAttempt = now
    void send().catch(() => { if (!disposed) lastAttempt = now - 115_000 })
  }
  const events = ['pointerdown', 'keydown', 'wheel', 'focus'] as const
  for (const name of events) targetWindow.addEventListener(name, signal, { passive: true })
  targetDocument.addEventListener('visibilitychange', signal)
  return () => {
    disposed = true
    for (const name of events) targetWindow.removeEventListener(name, signal)
    targetDocument.removeEventListener('visibilitychange', signal)
  }
}
