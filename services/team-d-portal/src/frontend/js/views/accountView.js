/**
 * Account page: identity summary and password change (all roles).
 */
window.views = window.views || {};

window.views.renderAccount = async function () {
  const c = document.getElementById('main-content');
  const user = window.store.get('user');
  c.innerHTML = `
    ${window.components.pageHeader({ title: 'Account & password', subtitle: 'Your sign-in identity and security settings.', tags: [['C', 'accounts'], ['D', 'portal']] })}
    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Profile</h3></div>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(user.name)}</dd>
          <dt>E-mail</dt><dd>${esc(user.email || '—')}</dd>
          <dt>Role</dt><dd><span class="chip">${esc(user.role)}</span></dd>
          <dt>User ID</dt><dd class="mono">${esc(user.id)}</dd>
        </dl>
        ${user.role === 'student' ? '<p style="margin-top:1rem;"><a class="btn btn-secondary btn-sm" href="#/student/profile">Edit placement profile</a></p>' : ''}
      </div>
      <div class="card"><div class="card-head"><h3>Change password</h3></div>
        <form id="pw-form" class="stack" style="gap:.8rem;" novalidate>
          <div class="form-group"><label for="pw-cur">Current password</label><input id="pw-cur" type="password" class="form-control" autocomplete="current-password"/></div>
          <div class="form-group"><label for="pw-new">New password</label><input id="pw-new" type="password" class="form-control" autocomplete="new-password"/><div class="form-help">Minimum 6 characters</div></div>
          <div class="form-group"><label for="pw-new2">Confirm new password</label><input id="pw-new2" type="password" class="form-control" autocomplete="new-password"/></div>
          <div id="pw-error" class="form-error" role="alert"></div>
          <div><button class="btn btn-primary" type="submit">Update password</button></div>
        </form>
      </div>
    </div>`;
  document.getElementById('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('pw-error');
    err.textContent = '';
    const cur = document.getElementById('pw-cur').value;
    const n1 = document.getElementById('pw-new').value;
    if (n1 !== document.getElementById('pw-new2').value) { err.textContent = 'New passwords do not match.'; return; }
    try {
      await window.api.changePassword(cur, n1);
      window.toast.success('Password updated');
      e.target.reset();
    } catch (ex) { err.textContent = window.components.errorText(ex); }
  });
};
