// Present the native login form at the application's bookmarkable entry point.
// Keycloak still owns the form action, session cookies and every OIDC parameter.
(() => {
  const present = () => {
    try {
      const current = new URL(window.location.href);
      const clients = current.searchParams.getAll('client_id');
      if (current.protocol !== 'https:' ||
          current.pathname !== '/realms/store-ops/login-actions/authenticate' ||
          clients.length !== 1 || clients[0] !== 'store-ops-admin-web') return;

      window.history.replaceState(window.history.state, '', '/auth/login');
    } catch {
      // Address presentation is optional; a restricted History API must not block login.
    }
  };
  // Native form responses can restore their URL after the head has executed.
  // Reapply before images finish loading and after back/forward cache restoration.
  window.addEventListener('DOMContentLoaded', present);
  window.addEventListener('pageshow', present);
  present();
})();
