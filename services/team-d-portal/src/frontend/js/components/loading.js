/**
 * Accessible Loading Skeletons, Error Alerts, and Empty State helper components for Team D.
 */

window.components = window.components || {};

window.components.renderLoading = function(message = 'Loading placement data...') {
  return `
    <div role="status" aria-live="polite" aria-busy="true" class="loading-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; color: var(--text-muted);">
      <div class="spinner" style="width: 32px; height: 32px; margin-bottom: 1rem;" aria-hidden="true"></div>
      <p style="font-size: 0.9rem; font-weight: 600; color: var(--rit-navy);">${message}</p>
    </div>
  `;
};

window.components.renderError = function(error, onRetry = null) {
  const msg = error?.message || 'Failed to load data from downstream service';
  const code = error?.code || 'ERROR';

  return `
    <div role="alert" aria-live="assertive" class="card" style="border-left: 4px solid var(--accent-rose); margin: 2rem 0; background: #ffffff;">
      <div style="display: flex; align-items: flex-start; gap: 1rem;">
        <div style="flex: 1;">
          <h3 style="color: var(--accent-rose); font-size: 1.1rem; margin-bottom: 0.35rem;">Unable to Complete Request</h3>
          <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem;">${msg}</p>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-family: 'JetBrains Mono'; margin-bottom: 1rem;">Error Code: ${code}</div>
          ${onRetry ? `<button class="btn btn-secondary btn-sm" onclick="${onRetry}">Retry Operation</button>` : ''}
        </div>
      </div>
    </div>
  `;
};

window.components.renderEmpty = function(title = 'No Records Found', message = 'There are no items to display at this time.') {
  return `
    <div role="status" class="card" style="text-align: center; padding: 3.5rem 1rem; background: #ffffff; margin: 1.5rem 0;">
      <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--rit-navy); margin-bottom: 0.35rem;">${title}</h3>
      <p style="color: var(--text-secondary); font-size: 0.88rem; max-width: 460px; margin: 0 auto;">${message}</p>
    </div>
  `;
};
