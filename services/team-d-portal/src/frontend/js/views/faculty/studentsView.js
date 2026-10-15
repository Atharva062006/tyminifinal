/**
 * Staff student directory: search, verify academic records, view details, register students.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderStudents = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const students = await window.api.getStudents();
  const f = window.__stuF = window.__stuF || { q: '', branch: '', verified: '' };
  const branches = [...new Set(students.map(s => s.branch))].sort();

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Students', subtitle: 'Verify academic records and manage student accounts. Eligibility uses the values stored here.',
      tags: [['C', 'student master data'], ['B', 'profile registry']],
      actions: '<button class="btn btn-primary btn-sm" id="add-student">+ Register student</button>',
    })}
    <div class="kpi-grid">
      ${window.components.kpi({ label: 'Students', value: students.length })}
      ${window.components.kpi({ label: 'Unverified records', value: students.filter(s => !s.academic_verified).length, tone: 'amber', meta: 'need checking against marksheets' })}
      ${window.components.kpi({ label: 'Average CGPA', value: students.length ? (students.reduce((a, s) => a + (s.cgpa || 0), 0) / students.length).toFixed(2) : '—', tone: 'cyan' })}
    </div>
    <div class="filter-bar">
      <input id="st-q" type="search" class="form-control" style="flex:2;" placeholder="Search name, ID, e-mail…" value="${esc(f.q)}" aria-label="Search students"/>
      <select id="st-branch" class="form-control" aria-label="Branch"><option value="">All branches</option>${branches.map(b => `<option ${f.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <select id="st-ver" class="form-control" aria-label="Verification"><option value="">Any verification</option><option value="yes" ${f.verified === 'yes' ? 'selected' : ''}>Verified</option><option value="no" ${f.verified === 'no' ? 'selected' : ''}>Unverified</option></select>
    </div>
    <div class="card" style="padding:.5rem;" id="st-table"></div>`;

  const draw = () => {
    const q = f.q.toLowerCase();
    const rows = students.filter(s =>
      (!q || `${s.student_id} ${s.name} ${s.email}`.toLowerCase().includes(q)) &&
      (!f.branch || s.branch === f.branch) &&
      (!f.verified || (f.verified === 'yes') === Boolean(s.academic_verified)));
    document.getElementById('st-table').innerHTML = window.components.renderDataTable({
      columns: [
        { label: 'Student', render: s => `<b>${esc(s.name)}</b><br><span class="muted small">${esc(s.student_id)} · ${esc(s.email)}</span>` },
        { label: 'Branch', render: s => esc(s.branch) },
        { label: 'CGPA', render: s => `<b>${esc(s.cgpa)}</b>` },
        { label: 'Backlogs', render: s => esc(s.backlogs) },
        { label: 'Attendance', render: s => esc(s.attendance != null ? s.attendance + '%' : '—') },
        { label: 'Skills', render: s => `<div class="facts">${(s.skills || []).slice(0, 4).map(x => `<span class="chip">${esc(x)}</span>`).join('')}${(s.skills || []).length > 4 ? `<span class="muted small">+${s.skills.length - 4}</span>` : ''}</div>` },
        { label: 'Readiness', render: s => `<b>${esc(s.readiness_score)}</b>/100` },
        { label: 'Record', render: s => `<span class="chip ${s.academic_verified ? 'green' : 'amber'}">${s.academic_verified ? 'verified' : 'unverified'}</span>` },
        { label: '', render: s => `<div class="row-actions"><button class="btn btn-secondary btn-sm" data-view="${esc(s.student_id)}">View</button><button class="btn ${s.academic_verified ? 'btn-ghost' : 'btn-success'} btn-sm" data-verify="${esc(s.student_id)}" data-to="${s.academic_verified ? 0 : 1}">${s.academic_verified ? 'Unverify' : 'Verify'}</button></div>` },
      ],
      rows, emptyMessage: 'No students match.',
    });
    document.querySelectorAll('[data-verify]').forEach(b => b.addEventListener('click', () => window.components.runAction(b, () => window.api.updateStudentProfile(b.dataset.verify, { academic_verified: b.dataset.to === '1' }), { success: 'Verification updated', refresh: () => window.views.faculty.renderStudents() })));
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      const s = students.find(x => x.student_id === b.dataset.view);
      window.modal.open({
        title: s.name,
        contentHtml: `<dl class="kv"><dt>Student ID</dt><dd class="mono">${esc(s.student_id)}</dd><dt>E-mail</dt><dd>${esc(s.email)}</dd><dt>Phone</dt><dd>${esc(s.phone || '—')}</dd><dt>Branch / year</dt><dd>${esc(s.branch)} · ${esc(s.year || '—')}</dd><dt>CGPA / backlogs</dt><dd>${esc(s.cgpa)} / ${esc(s.backlogs)}</dd><dt>Attendance</dt><dd>${esc(s.attendance ?? '—')}%</dd><dt>Skills</dt><dd>${(s.skills || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ') || '—'}</dd><dt>Projects</dt><dd>${(s.projects || []).map(p => esc(p.title)).join(', ') || '—'}</dd><dt>Certifications</dt><dd>${(s.certifications || []).map(p => esc(p.title)).join(', ') || '—'}</dd><dt>Resume</dt><dd>${s.resume_url ? `<a class="link" href="${esc(s.resume_url)}" target="_blank" rel="noopener">Open resume</a>` : 'Not provided'}</dd><dt>About</dt><dd>${esc(s.about || '—')}</dd></dl>`,
        buttons: [{ text: 'Close', className: 'btn-secondary', onClick: () => true }],
      });
    }));
  };
  document.getElementById('st-q').addEventListener('input', window.debounce(e => { f.q = e.target.value; draw(); }, 200));
  document.getElementById('st-branch').addEventListener('change', e => { f.branch = e.target.value; draw(); });
  document.getElementById('st-ver').addEventListener('change', e => { f.verified = e.target.value; draw(); });
  document.getElementById('add-student').addEventListener('click', () => window.components.formModal({
    title: 'Register a student', intro: 'Creates the student record and a login. If you leave the password empty the temporary password is "student123".', submitText: 'Register',
    fields: [
      { name: 'name', label: 'Full name', required: true, full: true },
      { name: 'email', label: 'E-mail', type: 'email', required: true, full: true },
      { name: 'branch', label: 'Branch', type: 'select', options: ['CSE', 'IT', 'ENTC', 'MECH', 'CIVIL', 'ELECTRICAL'] },
      { name: 'cgpa', label: 'CGPA', type: 'number', step: '0.01', min: 0, max: 10, required: true },
      { name: 'backlogs', label: 'Backlogs', type: 'number', min: 0, value: 0 },
      { name: 'attendance', label: 'Attendance %', type: 'number', min: 0, max: 100, value: 80 },
      { name: 'password', label: 'Temporary password', value: 'student123' },
    ],
    onSubmit: async (v) => { await window.api.createStudent(v); window.toast.success('Student registered'); window.views.faculty.renderStudents(); },
  }));
  draw();
};
