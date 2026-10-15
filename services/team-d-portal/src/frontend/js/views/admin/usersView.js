/**
 * Admin: user accounts and roles (create staff, activate / deactivate, reset password, change role).
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderUsers = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const me = window.store.get('user');
  const users = await window.api.getUsers();
  const f = window.__usrF = window.__usrF || { role: '', q: '' };

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Users & roles', subtitle: 'Students self-register; staff accounts are created here. Deactivated users cannot sign in.',
      tags: [['C', 'accounts (scrypt-hashed passwords)'], ['D', 'role-based access']],
      actions: '<button class="btn btn-primary" id="add-user">+ New staff account</button>',
    })}
    <div class="kpi-grid">${['student', 'faculty', 'admin', 'auditor'].map(r => window.components.kpi({ label: r[0].toUpperCase() + r.slice(1) + 's', value: users.filter(u => u.role === r).length })).join('')}</div>
    <div class="filter-bar">
      <input id="us-q" type="search" class="form-control" style="flex:2;" placeholder="Search name, e-mail, ID…" value="${esc(f.q)}" aria-label="Search users"/>
      <select id="us-role" class="form-control" aria-label="Role"><option value="">All roles</option>${['student', 'faculty', 'admin', 'auditor'].map(r => `<option ${f.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
    </div>
    <div class="card" style="padding:.5rem;" id="us-table"></div>`;

  const draw = () => {
    const q = f.q.toLowerCase();
    const rows = users.filter(u => (!f.role || u.role === f.role) && (!q || `${u.name} ${u.email} ${u.user_id}`.toLowerCase().includes(q)));
    document.getElementById('us-table').innerHTML = window.components.renderDataTable({
      columns: [
        { label: 'User', render: u => `<b>${esc(u.name)}</b><br><span class="muted small">${esc(u.email)}</span>` },
        { label: 'ID', render: u => `<span class="mono small">${esc(u.user_id)}</span>` },
        { label: 'Role', render: u => `<span class="chip">${esc(u.role)}</span>` },
        { label: 'Status', render: u => `<span class="chip ${u.active === false ? 'rose' : 'green'}">${u.active === false ? 'deactivated' : 'active'}</span>` },
        { label: 'Last sign-in', render: u => esc(u.last_login_at ? fmt.ago(u.last_login_at) : 'never') },
        { label: '', render: u => `<div class="row-actions">
          ${u.role !== 'student' ? `<select class="form-control" style="width:auto;padding:.25rem .4rem;font-size:.78rem;" data-role-of="${esc(u.user_id)}" aria-label="Role for ${esc(u.name)}">${['faculty', 'admin', 'auditor'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>` : ''}
          <button class="btn btn-secondary btn-sm" data-reset="${esc(u.user_id)}">Reset password</button>
          <button class="btn ${u.active === false ? 'btn-success' : 'btn-outline-danger'} btn-sm" data-active="${esc(u.user_id)}:${u.active === false ? 1 : 0}" ${u.user_id === me.id ? 'disabled' : ''}>${u.active === false ? 'Activate' : 'Deactivate'}</button></div>` },
      ],
      rows, emptyMessage: 'No users match.',
    });
    const refresh = () => window.views.admin.renderUsers();
    document.querySelectorAll('[data-active]').forEach(b => b.addEventListener('click', () => { const [id, to] = b.dataset.active.split(':'); window.components.runAction(b, () => window.api.updateUser(id, { active: to === '1' }), { success: 'Account updated', refresh }); }));
    document.querySelectorAll('[data-role-of]').forEach(s => s.addEventListener('change', () => window.components.runAction(s, () => window.api.updateUser(s.dataset.roleOf, { role: s.value }), { success: 'Role changed', refresh })));
    document.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => window.components.formModal({
      title: 'Reset password', intro: 'Set a new temporary password and share it with the user securely.', submitText: 'Reset',
      fields: [{ name: 'new_password', label: 'New password', type: 'text', required: true, help: 'Minimum 6 characters', full: true }],
      onSubmit: async (v) => { await window.api.updateUser(b.dataset.reset, { new_password: v.new_password }); window.toast.success('Password reset'); },
    })));
  };
  document.getElementById('us-q').addEventListener('input', window.debounce(e => { f.q = e.target.value; draw(); }, 200));
  document.getElementById('us-role').addEventListener('change', e => { f.role = e.target.value; draw(); });
  document.getElementById('add-user').addEventListener('click', () => window.components.formModal({
    title: 'New staff account', submitText: 'Create account',
    fields: [
      { name: 'name', label: 'Full name', required: true, full: true },
      { name: 'email', label: 'E-mail', type: 'email', required: true },
      { name: 'role', label: 'Role', type: 'select', options: ['faculty', 'admin', 'auditor'] },
      { name: 'password', label: 'Temporary password', required: true, full: true, help: 'Minimum 6 characters' },
    ],
    onSubmit: async (v) => { await window.api.createUser(v); window.toast.success('Account created'); window.views.admin.renderUsers(); },
  }));
  draw();
};
