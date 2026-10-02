// Only present the lifetime of this tab's existing PAR attempt. Never inspect,
// retain or forward credentials, and never change native actions or PKCE checks.
(() => {
  const form = document.getElementById('kc-form-login');
  const notice = document.getElementById('axis-login-expired');
  if (!form || !notice) return;
  const key = 'store-ops-admin-pkce-login';
  let attempt;
  try {
    const action = new URL(form.action, window.location.href);
    if (action.origin !== window.location.origin ||
        action.pathname !== '/realms/store-ops/login-actions/authenticate' ||
        action.searchParams.getAll('client_id').length !== 1 ||
        action.searchParams.get('client_id') !== 'store-ops-admin-web') return;
    // Keycloak 26.7.3 carries the original state in native client_data.st.
    // Matching it prevents a restored form from adopting a newer tab attempt.
    const data = action.searchParams.get('client_data');
    if (!data || data.length > 4096 || !/^[A-Za-z0-9_-]+={0,2}$/.test(data)) return;
    const state = JSON.parse(window.atob(data.replace(/-/g, '+').replace(/_/g, '/'))).st;
    attempt = JSON.parse(window.sessionStorage.getItem(key));
    if (!attempt || typeof state !== 'string' || attempt.state !== state ||
        !Number.isFinite(attempt.createdAt) || attempt.createdAt > Date.now() ||
        !Number.isFinite(attempt.authorizationExpiresAt) ||
        attempt.authorizationExpiresAt <= attempt.createdAt ||
        attempt.authorizationExpiresAt > attempt.createdAt + 600000) return;
  } catch {
    // External entry or unavailable storage still has native provider validation
    // and an explicit fresh-login link. Metadata never authenticates anyone.
    return;
  }

  let expired = false;
  let timer;
  const check = () => {
    clearTimeout(timer);
    if (!expired) {
      let superseded = false;
      try {
        superseded = JSON.parse(window.sessionStorage.getItem(key))?.state !== attempt.state;
      } catch { superseded = true; }
      expired = superseded || Date.now() >= attempt.authorizationExpiresAt;
    }
    if (expired) {
      form.hidden = true;
      notice.hidden = false;
      const restart = document.getElementById('axis-login-restart');
      if (restart) restart.hidden = true;
    } else {
      timer = setTimeout(check, Math.max(1, attempt.authorizationExpiresAt - Date.now()));
    }
    return expired;
  };
  form.addEventListener('submit', (event) => {
    if (check()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notice.querySelector('a')?.focus();
    }
  }, true);
  window.addEventListener('pageshow', check);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  document.addEventListener('visibilitychange', check);
  check();
})();
