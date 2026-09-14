// Progressive enhancement only. Authentication stays in Keycloak's native form.
const help = document.getElementById('axis-help')
const helpButton = document.getElementById('axis-help-button')
const closeButton = document.getElementById('axis-help-close')

helpButton?.addEventListener('click', () => {
  if (!help) return
  help.hidden = !help.hidden
  helpButton.setAttribute('aria-expanded', String(!help.hidden))
})
closeButton?.addEventListener('click', () => {
  if (!help) return
  help.hidden = true
  helpButton?.setAttribute('aria-expanded', 'false')
  helpButton?.focus()
})

const username = document.getElementById('username')
const password = document.getElementById('password')
if (document.body.dataset.pageId === 'login-login') {
  if (username) username.placeholder = document.body.dataset.usernamePlaceholder ?? ''
  if (password) password.placeholder = document.body.dataset.passwordPlaceholder ?? ''
}
const capsHint = document.getElementById('axis-caps-lock')
password?.addEventListener('keyup', (event) => {
  if (capsHint) capsHint.hidden = !event.getModifierState('CapsLock')
})
password?.addEventListener('blur', () => {
  if (capsHint) capsHint.hidden = true
})
