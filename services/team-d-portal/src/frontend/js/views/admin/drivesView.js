/**
 * Drive management (staff): create, edit eligibility criteria / seats / package / state.
 * Criteria changes are versioned in Team C and pushed to the ranking engine profile registry (Team B).
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin._driveForm = async function (drive) {
  const companies = await window.api.getCompanies();
  const crit = drive?.criteria || {};
  const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : '');
  const isEdit = Boolean(drive);
  window.components.formModal({
    title: isEdit ? `Edit drive — ${drive.title}` : 'Create drive',
    intro: isEdit ? 'Changes apply to future evaluations. Applications in flight keep their recorded decision.' : 'New drives start as Draft — students only see them once you open the drive.',
    submitText: isEdit ? 'Save changes' : 'Create drive',
    fields: [
      { name: 'company_id', label: 'Company', type: 'select', options: companies.map(c => ({ value: c.company_id, label: c.name })), value: drive?.company_id, required: true },
      { name: 'title', label: 'Role / title', value: drive?.title || '', required: true },
      { name: 'seats', label: 'Total seats', type: 'number', min: 1, value: drive?.seats_total || drive?.seats || 5, required: true },
      { name: 'package', label: 'Package (₹ per year)', type: 'number', min: 0, value: drive?.package || '', help: '₹7.5 LPA = 750000' },
      { name: 'location', label: 'Location', value: drive?.location || '' },
      { name: 'deadline', label: 'Application deadline', type: 'date', value: toDateInput(drive?.deadline) },
      { name: 'state', label: 'State', type: 'select', options: ['DRAFT', 'OPEN', 'SCREENING', 'CLOSED', 'CANCELLED'], value: drive?.state || 'DRAFT' },
      { name: 'description', label: 'Description', type: 'textarea', value: drive?.description || '', full: true },
      { name: 'min_cgpa', label: 'Minimum CGPA', type: 'number', step: '0.1', min: 0, max: 10, value: crit.min_cgpa ?? 7 },
      { name: 'max_backlogs', label: 'Max active backlogs', type: 'number', min: 0, value: crit.max_backlogs ?? 0 },
      { name: 'min_attendance', label: 'Min attendance %', type: 'number', min: 0, max: 100, value: crit.min_attendance ?? 75 },
      { name: 'branches', label: 'Allowed branches', value: (crit.branches || []).join(', '), help: 'Comma separated, e.g. CSE, IT. Leave empty for all.' },
      { name: 'required_skills', label: 'Required skills', value: (crit.required_skills || []).join(', '), help: 'Comma separated. Candidates matching ≥ 50% pass; fewer = conditional.', full: true },
    ],
    onSubmit: async (v) => {
      const list = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
      const payload = {
        company_id: v.company_id, title: v.title, seats: Number(v.seats), package: v.package === '' ? undefined : Number(v.package),
        location: v.location || undefined, deadline: v.deadline ? new Date(v.deadline).toISOString() : undefined,
        state: v.state, description: v.description || undefined,
        criteria: { min_cgpa: Number(v.min_cgpa), max_backlogs: Number(v.max_backlogs), min_attendance: Number(v.min_attendance), branches: list(v.branches), required_skills: list(v.required_skills) },
      };
      if (isEdit) await window.api.updateDrive(drive.drive_id, payload); else await window.api.createDrive(payload);
      window.toast.success(isEdit ? 'Drive updated' : 'Drive created');
      window.views.admin.renderDrives();
    },
  });
};

window.views.admin.renderDrives = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const [drives, apps] = await Promise.all([window.api.getDrives(), window.api.getApplications().catch(() => [])]);
  const f = window.__drvF = window.__drvF || { state: '' };
  const rows = drives.filter(d => !f.state || d.state === f.state);

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Placement drives', subtitle: 'Create drives, define eligibility criteria and control the drive lifecycle.',
      tags: [['C', 'drive master data & seats'], ['A', 'rule set source'], ['B', 'requirement graph']],
      actions: '<button class="btn btn-primary" id="new-drive">+ New drive</button>',
    })}
    ${window.components.tabs([{ id: '', label: `All (${drives.length})` }, ...['DRAFT', 'OPEN', 'SCREENING', 'CLOSED', 'CANCELLED'].map(s => ({ id: s, label: `${s[0]}${s.slice(1).toLowerCase()} (${drives.filter(d => d.state === s).length})` }))], f.state)}
    <div class="card" style="padding:.5rem;">
      ${window.components.renderDataTable({
        columns: [
          { label: 'Drive', render: d => `<b>${esc(d.title)}</b><br><span class="muted small">${esc(d.company?.name || d.company_id)} · ${esc(d.drive_id)}</span>` },
          { label: 'State', render: d => `<span class="badge badge-${esc(String(d.state).toLowerCase())}">${esc(d.state)}</span>` },
          { label: 'Criteria', render: d => { const c = d.criteria || {}; return `<span class="small">CGPA ≥ ${esc(c.min_cgpa ?? '—')} · backlogs ≤ ${esc(c.max_backlogs ?? '—')} · ${esc((c.branches || []).join('/') || 'all branches')}</span><div class="facts" style="margin-top:.2rem;">${(c.required_skills || []).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>`; } },
          { label: 'Seats', render: d => `${esc(d.seats)} / ${esc(d.seats_total || d.seats)}` },
          { label: 'Package', render: d => esc(fmt.money(d.package)) },
          { label: 'Applicants', render: d => esc(apps.filter(a => a.drive_id === d.drive_id).length) },
          { label: '', render: d => `<div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="${esc(d.drive_id)}">Edit</button>${d.state === 'DRAFT' ? `<button class="btn btn-success btn-sm" data-state="${esc(d.drive_id)}:OPEN">Open</button>` : ''}${d.state === 'OPEN' ? `<button class="btn btn-warn btn-sm" data-state="${esc(d.drive_id)}:CLOSED">Close</button>` : ''}${d.state === 'CLOSED' ? `<button class="btn btn-ghost btn-sm" data-state="${esc(d.drive_id)}:OPEN">Reopen</button>` : ''}</div>` },
        ],
        rows, emptyMessage: 'No drives in this state.',
      })}
    </div>`;

  c.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => { f.state = t.dataset.tab; window.views.admin.renderDrives(); }));
  document.getElementById('new-drive').addEventListener('click', () => window.views.admin._driveForm(null));
  c.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => window.views.admin._driveForm(drives.find(d => d.drive_id === b.dataset.edit))));
  c.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => {
    const [id, state] = b.dataset.state.split(':');
    window.components.runAction(b, () => window.api.updateDrive(id, { state }), { success: `Drive ${state.toLowerCase()}`, refresh: () => window.views.admin.renderDrives() });
  }));
};
