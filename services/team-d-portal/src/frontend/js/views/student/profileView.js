/**
 * Student profile: self-service editing of contact info, academics, skills (Team B suggestions),
 * projects, certifications, links — plus the placement readiness score.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderProfile = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');
  const { student: s, readiness } = await window.api.getStudentProfile(user.id);
  const state = { skills: [...(s.skills || [])], projects: [...(s.projects || [])], certifications: [...(s.certifications || [])] };
  const branches = ['CSE', 'IT', 'ENTC', 'MECH', 'CIVIL', 'ELECTRICAL'];
  const score = readiness.readiness_score || 0;

  const listEditor = (key, label, fields) => `
    <div class="card"><div class="card-head"><h3>${label}</h3><button class="btn btn-secondary btn-sm" data-add="${key}">+ Add</button></div>
      <div id="list-${key}"></div></div>`;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'My profile', subtitle: 'Keep this up to date — it feeds eligibility checks, ranking and what recruiters see.',
      tags: [['C', 'student record'], ['B', 'skill graph profile']],
    })}
    <div class="grid split">
      <div class="stack">
        <form id="basic-form" class="card" novalidate>
          <div class="card-head"><h3>Personal details</h3></div>
          <div class="form-grid">
            <div class="form-group"><label for="p-name">Full name</label><input id="p-name" class="form-control" value="${esc(s.name)}" required/></div>
            <div class="form-group"><label>E-mail</label><input class="form-control" value="${esc(s.email)}" disabled/><div class="form-help">Contact the placement cell to change your e-mail.</div></div>
            <div class="form-group"><label for="p-phone">Phone</label><input id="p-phone" class="form-control" value="${esc(s.phone || '')}" placeholder="10-digit mobile"/></div>
            <div class="form-group"><label for="p-year">Year</label><select id="p-year" class="form-control"><option value="4" ${s.year === 4 ? 'selected' : ''}>Final year</option><option value="3" ${s.year === 3 ? 'selected' : ''}>Third year</option></select></div>
            <div class="form-group full"><label for="p-about">About me</label><textarea id="p-about" class="form-control" placeholder="A short summary for recruiters">${esc(s.about || '')}</textarea></div>
            <div class="form-group full"><label for="p-resume">Resume link</label><input id="p-resume" class="form-control" type="url" value="${esc(s.resume_url || '')}" placeholder="https://drive.google.com/…"/></div>
            <div class="form-group"><label for="p-gh">GitHub</label><input id="p-gh" class="form-control" type="url" value="${esc(s.github_url || '')}"/></div>
            <div class="form-group"><label for="p-li">LinkedIn</label><input id="p-li" class="form-control" type="url" value="${esc(s.linkedin_url || '')}"/></div>
          </div>
          <div class="row" style="margin-top:1rem;"><button class="btn btn-primary" type="submit">Save details</button><span id="basic-msg" class="small"></span></div>
        </form>

        <form id="acad-form" class="card" novalidate>
          <div class="card-head"><h3>Academic record</h3><span class="chip ${s.academic_verified ? 'green' : 'amber'}">${s.academic_verified ? 'Verified by placement cell' : 'Pending verification'}</span></div>
          <div class="form-grid">
            <div class="form-group"><label for="a-cgpa">CGPA</label><input id="a-cgpa" type="number" step="0.01" min="0" max="10" class="form-control" value="${esc(s.cgpa)}"/></div>
            <div class="form-group"><label for="a-back">Active backlogs</label><input id="a-back" type="number" min="0" class="form-control" value="${esc(s.backlogs)}"/></div>
            <div class="form-group"><label for="a-att">Attendance %</label><input id="a-att" type="number" min="0" max="100" class="form-control" value="${esc(s.attendance ?? 80)}"/></div>
            <div class="form-group"><label for="a-branch">Branch</label><select id="a-branch" class="form-control">${branches.map(b => `<option ${b === s.branch ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
          </div>
          <div class="alert info" style="margin:1rem 0 0;"><div>Editing academic values marks your record as <b>unverified</b> until the placement cell re-checks it against official marksheets. Eligibility decisions use the values stored here.</div></div>
          <div class="row" style="margin-top:1rem;"><button class="btn btn-primary" type="submit">Save academics</button><span id="acad-msg" class="small"></span></div>
        </form>

        <div class="card"><div class="card-head"><h3>Skills</h3>${window.components.teamTag('B', 'skill graph & trie suggestions')}</div>
          <div class="tag-input" id="skill-box"><span id="skill-chips"></span><input id="skill-input" list="skill-suggest" placeholder="Type a skill and press Enter…" aria-label="Add skill"/><datalist id="skill-suggest"></datalist></div>
          <p class="form-help">Skills are matched against each drive requirement to compute your ranking score.</p>
          <div class="row" style="margin-top:.75rem;"><button id="save-skills" class="btn btn-primary btn-sm">Save skills</button><span id="skills-msg" class="small"></span></div>
        </div>

        ${listEditor('projects', 'Projects')}
        ${listEditor('certifications', 'Certifications')}
      </div>

      <div class="stack">
        <div class="card" style="text-align:center;">
          <div class="card-head" style="justify-content:center;"><h3>Placement readiness</h3></div>
          <div style="position:relative;width:140px;height:140px;margin:0 auto;">
            <svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:100%;height:100%;"><path d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32" fill="none" stroke="#e2e8f0" stroke-width="3.4"/><path d="M18 2a16 16 0 1 1 0 32 16 16 0 0 1 0-32" fill="none" stroke="${score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${score}, 100"/></svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><b style="font-size:2rem;color:var(--rit-navy);">${score}</b><span class="small muted">of 100</span></div>
          </div>
          <div style="text-align:left;margin-top:1rem;">${Object.entries(readiness.breakdown || {}).map(([k, v]) => `<div class="row between small"><span style="text-transform:capitalize;">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
          ${window.components.teamTag('D', 'advisory score')}
        </div>
        <div class="card"><div class="card-head"><h3>Suggestions</h3></div>
          ${(readiness.recommendations || []).length ? `<ul class="todo-list">${readiness.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="sub">Your profile looks complete. 🎉</p>'}
        </div>
      </div>
    </div>`;

  const save = async (payload, msgId, btn) => {
    const msg = document.getElementById(msgId);
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      await window.api.updateStudentProfile(user.id, payload);
      msg.textContent = 'Saved ✓'; msg.style.color = 'var(--accent-emerald)';
      window.toast.success('Profile updated');
      return true;
    } catch (e) {
      msg.textContent = window.components.errorText(e); msg.style.color = 'var(--accent-rose)';
      return false;
    }
  };
  const v = (id) => document.getElementById(id).value.trim();

  document.getElementById('basic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!v('p-name')) { document.getElementById('basic-msg').textContent = 'Name is required'; return; }
    await save({ name: v('p-name'), phone: v('p-phone') || undefined, year: Number(v('p-year')), about: v('p-about'), resume_url: v('p-resume'), github_url: v('p-gh'), linkedin_url: v('p-li') }, 'basic-msg');
  });
  document.getElementById('acad-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await save({ cgpa: Number(v('a-cgpa')), backlogs: Number(v('a-back')), attendance: Number(v('a-att')), branch: v('a-branch') }, 'acad-msg')) window.views.student.renderProfile();
  });

  // Skills editor with Team B trie suggestions
  const drawSkills = () => {
    document.getElementById('skill-chips').innerHTML = state.skills.map((sk, i) => `<span class="chip">${esc(sk)} <button type="button" data-rm-skill="${i}" aria-label="Remove ${esc(sk)}">×</button></span>`).join(' ');
    document.querySelectorAll('[data-rm-skill]').forEach(b => b.addEventListener('click', () => { state.skills.splice(Number(b.dataset.rmSkill), 1); drawSkills(); }));
  };
  drawSkills();
  const input = document.getElementById('skill-input');
  input.addEventListener('input', window.debounce(async () => {
    if (input.value.length < 1) return;
    try {
      const r = await window.api.skillSuggestions(input.value);
      document.getElementById('skill-suggest').innerHTML = (r.suggestions || []).map(x => `<option value="${esc(x.skill)}">${esc(x.students)} student(s)</option>`).join('');
    } catch { /* suggestions are optional */ }
  }, 200));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = input.value.trim().replace(/,$/, '');
    if (val && !state.skills.some(x => x.toLowerCase() === val.toLowerCase())) { state.skills.push(val); drawSkills(); }
    input.value = '';
  });
  document.getElementById('save-skills').addEventListener('click', async () => { if (await save({ skills: state.skills }, 'skills-msg')) window.views.student.renderProfile(); });

  // Projects / certifications list editors
  const defs = {
    projects: { title: 'Project', fields: [{ name: 'title', label: 'Title', required: true, full: true }, { name: 'description', label: 'Description', type: 'textarea', full: true }, { name: 'link', label: 'Link (GitHub / demo)', type: 'url', full: true }], line: (x) => `<b>${esc(x.title)}</b><div class="sub small">${esc(x.description || '')}</div>${x.link ? `<a class="link small" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a>` : ''}` },
    certifications: { title: 'Certification', fields: [{ name: 'title', label: 'Certification', required: true, full: true }, { name: 'issuer', label: 'Issued by', full: true }], line: (x) => `<b>${esc(x.title)}</b><div class="sub small">${esc(x.issuer || '')}</div>` },
  };
  const drawList = (key) => {
    const box = document.getElementById(`list-${key}`);
    box.innerHTML = state[key].length ? state[key].map((x, i) => `<div class="list-item"><div>${defs[key].line(x)}</div><button class="btn btn-ghost btn-sm" data-rm="${key}:${i}" aria-label="Remove">Remove</button></div>`).join('') : `<p class="sub">No ${key} added yet.</p>`;
    box.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
      const [k, i] = b.dataset.rm.split(':');
      state[k].splice(Number(i), 1);
      if (await save({ [k]: state[k] }, 'basic-msg')) drawList(k);
    }));
  };
  ['projects', 'certifications'].forEach(drawList);
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.add;
    window.components.formModal({
      title: `Add ${defs[key].title.toLowerCase()}`, fields: defs[key].fields, submitText: 'Add',
      onSubmit: async (vals) => {
        const next = [...state[key], vals];
        await window.api.updateStudentProfile(user.id, { [key]: next });
        state[key] = next; drawList(key); window.toast.success(`${defs[key].title} added`);
      },
    });
  }));
};
