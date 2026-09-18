/**
 * Client-Side SPA Hash Router with Role Guards for Team D Frontend.
 */

class Router {
  constructor() {
    this.routes = new Map();
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  register(pattern, viewHandler, allowedRoles = []) {
    this.routes.set(pattern, { viewHandler, allowedRoles });
  }

  navigate(path) {
    window.location.hash = path;
  }

  async handleRoute() {
    let hash = window.location.hash || '#/';
    if (hash === '#/' || !hash) {
      const user = window.store.get('user');
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      if (user.role === 'admin') window.location.hash = '#/admin/dashboard';
      else if (user.role === 'faculty') window.location.hash = '#/faculty/dashboard';
      else window.location.hash = '#/student/dashboard';
      return;
    }

    // Strip query string for route pattern matching
    const [pathOnly] = hash.split('?');
    const cleanPath = pathOnly.replace(/^#/, '');

    const user = window.store.get('user');

    // If at login
    if (cleanPath === '/login') {
      document.body.className = 'auth-layout';
      document.getElementById('main-content').innerHTML = window.views.renderLoginView();
      window.views.bindLoginEvents();
      return;
    }

    // If not logged in and not at login, redirect
    if (!user) {
      window.location.hash = '#/login';
      return;
    }

    document.body.className = '';

    // Update shell navigation
    this._renderShell();

    // Match route
    let matchedRoute = null;
    let params = {};

    for (const [pattern, config] of this.routes.entries()) {
      const regexPattern = '^' + pattern.replace(/:([a-zA-Z0-9_]+)/g, '(?<$1>[^/]+)') + '$';
      const match = cleanPath.match(new RegExp(regexPattern));
      if (match) {
        matchedRoute = config;
        params = match.groups || {};
        break;
      }
    }

    if (!matchedRoute) {
      this._renderNotFound();
      return;
    }

    // Role check (Admin has super-user access to all views)
    if (matchedRoute.allowedRoles.length > 0 && !matchedRoute.allowedRoles.includes(user.role) && user.role !== 'admin') {
      this._renderForbidden();
      return;
    }

    // Execute view
    try {
      await matchedRoute.viewHandler(params);
    } catch (err) {
      console.error('[Router] Error executing view handler:', err);
      document.getElementById('main-content').innerHTML = window.components.renderError(err, "window.router.handleRoute()");
    }
  }

  _renderShell() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const headerContainer = document.getElementById('header-container');

    if (sidebarContainer) sidebarContainer.innerHTML = window.components.renderSidebar();
    if (headerContainer) {
      headerContainer.innerHTML = window.components.renderHeader();

      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          await window.api.logout();
          window.sseClient.disconnect();
          window.location.hash = '#/login';
        });
      }

      const mobileBtn = document.getElementById('mobile-menu-btn');
      if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
          const navBar = document.getElementById('primary-nav-bar');
          if (navBar) navBar.classList.toggle('mobile-closed');
        });
      }
    }
  }

  _renderForbidden() {
    document.getElementById('main-content').innerHTML = `
      <div class="card" style="text-align: center; padding: 4rem 1rem; max-width: 600px; margin: 3rem auto; border-top: 4px solid var(--accent-rose);">
        <h2 style="font-size: 2rem; font-weight: 800; color: var(--accent-rose); margin-bottom: 0.5rem;">403 Forbidden</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">You do not have institutional permissions to access this view with your current role.</p>
        <a href="#/" class="btn btn-primary">Return to My Dashboard</a>
      </div>
    `;
  }

  _renderNotFound() {
    document.getElementById('main-content').innerHTML = `
      <div class="card" style="text-align: center; padding: 4rem 1rem; max-width: 600px; margin: 3rem auto;">
        <h2 style="font-size: 2rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem;">404 Page Not Found</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The placement portal route you requested does not exist.</p>
        <a href="#/" class="btn btn-primary">Return to Dashboard</a>
      </div>
    `;
  }
}

window.router = new Router();
