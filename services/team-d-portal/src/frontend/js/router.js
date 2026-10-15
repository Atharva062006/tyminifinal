/**
 * Client-side hash router with role guards for the Team D SPA.
 * Routes flagged `refresh` are re-rendered silently when a live event arrives (D3 freshness).
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.refreshable = false;
    this.isSilent = false;
    this.renderToken = 0;
    window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); this.handleRoute(); });
  }

  register(pattern, viewHandler, allowedRoles = [], options = {}) {
    this.routes.set(pattern, { viewHandler, allowedRoles, refresh: Boolean(options.refresh) });
  }

  navigate(path) { window.location.hash = path; }

  _publicRoute(path) { return path === '/login' || path === '/register'; }

  async handleRoute({ silent = false } = {}) {
    const hash = window.location.hash || '#/';
    const user = window.store.get('user');
    const [pathOnly] = hash.split('?');
    const cleanPath = pathOnly.replace(/^#/, '') || '/';

    if (cleanPath === '/' ) {
      if (!user) { window.location.hash = '#/login'; return; }
      window.location.hash = window.components.homeFor(user.role);
      return;
    }

    if (this._publicRoute(cleanPath)) {
      if (user && window.api.isAuthenticated()) { window.location.hash = window.components.homeFor(user.role); return; }
      document.body.className = 'auth-layout';
      const main = document.getElementById('main-content');
      main.innerHTML = cleanPath === '/login' ? window.views.renderLoginView() : window.views.renderRegisterView();
      if (cleanPath === '/login') window.views.bindLoginEvents(); else window.views.bindRegisterEvents();
      return;
    }

    if (!user || !window.api.isAuthenticated()) { window.location.hash = '#/login'; return; }

    document.body.classList.remove('auth-layout');
    if (!silent) this._renderShell();
    else this._refreshActiveNav();

    let matched = null;
    let params = {};
    for (const [pattern, config] of this.routes.entries()) {
      const rx = '^' + pattern.replace(/:([a-zA-Z0-9_]+)/g, '(?<$1>[^/]+)') + '$';
      const m = cleanPath.match(new RegExp(rx));
      if (m) { matched = config; params = m.groups || {}; break; }
    }
    if (!matched) { this._renderNotFound(); return; }

    const role = user.role === 'tpo' ? 'faculty' : user.role;
    if (matched.allowedRoles.length && !matched.allowedRoles.includes(role) && role !== 'admin') {
      this._renderForbidden();
      return;
    }

    this.refreshable = matched.refresh;
    this.isSilent = silent;
    const token = ++this.renderToken;
    const container = document.getElementById('main-content');
    const scrollY = silent ? window.scrollY : 0;
    try {
      await matched.viewHandler(params);
    } catch (err) {
      console.error('[Router] Error executing view handler:', err);
      if (token === this.renderToken) container.innerHTML = window.components.renderError(err, 'window.router.handleRoute()');
    } finally {
      this.isSilent = false;
    }
    if (token !== this.renderToken) return; // a newer navigation superseded this render
    const banner = window.components.degradedBanner(window.store.get('degraded'));
    if (banner) container.insertAdjacentHTML('afterbegin', banner);
    if (silent) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
    container.focus({ preventScroll: true });
  }

  _renderShell() {
    const header = document.getElementById('header-container');
    const side = document.getElementById('sidebar-container');
    const footer = document.querySelector('#footer .footer-container, #footer');
    if (header) { header.innerHTML = window.components.renderHeader(); window.components.bindShell(); }
    if (side) side.innerHTML = window.components.renderSidebar();
    const f = document.getElementById('footer');
    if (f) f.innerHTML = window.components.renderFooter();
    if (!window.__unreadLoaded) { window.__unreadLoaded = true; window.components.refreshUnread(); }
  }

  _refreshActiveNav() {
    const side = document.getElementById('sidebar-container');
    if (side) side.innerHTML = window.components.renderSidebar();
  }

  _renderForbidden() {
    document.getElementById('main-content').innerHTML = `
      <div class="card" style="text-align:center;padding:3.5rem 1rem;max-width:560px;margin:3rem auto;border-top:4px solid var(--accent-rose);">
        <h2 style="color:var(--accent-rose);margin-bottom:.4rem;">Access restricted</h2>
        <p class="sub" style="margin-bottom:1.25rem;">Your role does not have permission to open this page. The server enforces this independently of what the menu shows.</p>
        <a href="#/" class="btn btn-primary">Back to my dashboard</a>
      </div>`;
  }

  _renderNotFound() {
    document.getElementById('main-content').innerHTML = `
      <div class="card" style="text-align:center;padding:3.5rem 1rem;max-width:560px;margin:3rem auto;">
        <h2 style="color:var(--text-muted);margin-bottom:.4rem;">Page not found</h2>
        <p class="sub" style="margin-bottom:1.25rem;">The page you requested does not exist.</p>
        <a href="#/" class="btn btn-primary">Back to dashboard</a>
      </div>`;
  }
}

window.router = new Router();

/** Views call this instead of drawing their own spinner so silent live-refreshes do not flicker. */
window.components.beginLoad = function (container, message = 'Loading…') {
  if (window.router.isSilent) return;
  container.innerHTML = window.components.skeleton(3);
  container.setAttribute('aria-busy', 'true');
};
