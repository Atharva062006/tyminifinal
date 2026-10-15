/**
 * Shared UI helpers: escaping, formatting, provenance tags, page headers, form modals, field readers.
 * Everything that renders server-supplied text goes through esc() to prevent HTML injection.
 */
window.components = window.components || {};

window.esc = function (value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
};

window.fmt = {
  money(rupees) {
    if (rupees === null || rupees === undefined || rupees === '' || Number.isNaN(Number(rupees))) return '—';
    const n = Number(rupees);
    return n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)} LPA` : `₹${n.toLocaleString('en-IN')}`;
  },
  date(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; },
  dateTime(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; },
  time(iso) { return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'; },
  ago(iso) {
    if (!iso) return '—';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  },
  pct(n, d = 0) { return `${Number(n || 0).toFixed(d)}%`; },
  num(n, d = 2) { return n === null || n === undefined ? '—' : Number(n).toFixed(d); },
  initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); },
  toLocalInput(iso) {
    const d = iso ? new Date(iso) : new Date(Date.now() + 86400000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  },
};

const TEAMS = {
  A: 'Team A · Eligibility & slots (OS)',
  B: 'Team B · Ranking & analytics (DS)',
  C: 'Team C · Data & workflow (DBMS)',
  D: 'Team D · Portal & BFF (Web)',
};
const TEAM_SHORT = { A: 'Team A', B: 'Team B', C: 'Team C', D: 'Team D' };

/** Tiny "this part was built by Team X" label. `what` is the specific capability. */
window.components.teamTag = function (team, what) {
  const t = String(team).toUpperCase();
  return `<span class="team-tag ${t}" title="${esc(TEAMS[t] || '')}${what ? ' — ' + esc(what) : ''}"><i></i>${TEAM_SHORT[t] || t}${what ? ' · ' + esc(what) : ''}</span>`;
};

window.components.teamTags = function (list) {
  return `<span class="team-tags">${list.map(([t, w]) => window.components.teamTag(t, w)).join('')}</span>`;
};

/** Standard page header with optional breadcrumb, provenance tags and action buttons. */
window.components.pageHeader = function ({ title, subtitle = '', crumbs = [], tags = [], actions = '' }) {
  const crumbHtml = crumbs.length
    ? `<div class="crumbs">${crumbs.map(c => (c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : esc(c.label))).join(' / ')}</div>` : '';
  return `
    <div class="page-head">
      <div>
        ${crumbHtml}
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        ${tags.length ? `<div class="head-meta">${window.components.teamTags(tags)}</div>` : ''}
      </div>
      <div class="page-actions">${actions}</div>
    </div>`;
};

window.components.kpi = function ({ label, value, meta = '', tone = '' }) {
  return `<div class="kpi ${tone}"><div class="k-label">${esc(label)}</div><div class="k-value">${value ?? 0}</div>${meta ? `<div class="k-meta">${meta}</div>` : ''}</div>`;
};

window.components.emptyState = function (title, message, actionHtml = '') {
  return `<div class="empty-state"><b>${esc(title)}</b><p>${esc(message)}</p>${actionHtml ? `<div style="margin-top:.9rem;">${actionHtml}</div>` : ''}</div>`;
};

window.components.skeleton = function (rows = 3) {
  return `<div class="stack" aria-busy="true" aria-label="Loading">${Array.from({ length: rows }, () => '<div class="skeleton" style="height:84px;"></div>').join('')}</div>`;
};

window.components.companyLogo = function (name) {
  return `<div class="co-logo" aria-hidden="true">${esc(fmt.initial(name))}</div>`;
};

/** Bannner shown when any engine answered from a fallback (meta.degraded). */
window.components.degradedBanner = function (degraded) {
  if (!degraded || !degraded.length) return '';
  const rows = degraded.map(d => `<li><b>${esc(d.source)}</b>: ${esc(d.reason)}</li>`).join('');
  return `<div class="alert warn degraded-bar" role="status"><div><b>Running in degraded mode.</b> Some results below come from a local fallback instead of the live engine.<ul style="margin:.35rem 0 0 1.1rem;">${rows}</ul></div></div>`;
};

/**
 * Open a modal with a simple form. fields: [{name,label,type,value,required,options,help,placeholder,full}]
 * onSubmit(values) may throw; the error is shown inside the modal and the modal stays open.
 */
window.components.formModal = function ({ title, intro = '', fields = [], submitText = 'Save', submitClass = 'btn-primary', onSubmit, extraHtml = '' }) {
  const fieldHtml = fields.map(f => {
    const id = `fm-${f.name}`;
    let control;
    if (f.type === 'select') {
      control = `<select id="${id}" name="${f.name}" class="form-control">${(f.options || []).map(o => {
        const val = typeof o === 'object' ? o.value : o; const lab = typeof o === 'object' ? o.label : o;
        return `<option value="${esc(val)}" ${String(val) === String(f.value ?? '') ? 'selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea id="${id}" name="${f.name}" class="form-control" placeholder="${esc(f.placeholder || '')}">${esc(f.value ?? '')}</textarea>`;
    } else if (f.type === 'checkbox') {
      control = `<label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${f.value ? 'checked' : ''}/> <span>${f.label}</span></label>`;
    } else {
      control = `<input id="${id}" name="${f.name}" class="form-control" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} />`;
    }
    return `<div class="form-group ${f.full ? 'full' : ''}">${f.type === 'checkbox' ? '' : `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>`}${control}${f.help ? `<div class="form-help">${esc(f.help)}</div>` : ''}</div>`;
  }).join('');

  window.modal.open({
    title,
    contentHtml: `${intro ? `<p class="sub" style="margin-bottom:1rem;">${esc(intro)}</p>` : ''}<form id="fm-form" class="form-grid" novalidate>${fieldHtml}</form>${extraHtml}<div id="fm-error" class="form-error" role="alert" style="margin-top:.75rem;"></div>`,
    buttons: [
      { text: 'Cancel', className: 'btn-secondary', onClick: () => true },
      {
        text: submitText,
        className: submitClass,
        onClick: async (e, backdrop) => {
          const form = backdrop.querySelector('#fm-form');
          const errBox = backdrop.querySelector('#fm-error');
          errBox.textContent = '';
          const values = {};
          for (const f of fields) {
            const el = form.elements[f.name];
            if (!el) continue;
            let v = f.type === 'checkbox' ? el.checked : el.value;
            if (f.type === 'number' && v !== '') v = Number(v);
            if (f.required && (v === '' || v === null || v === undefined)) {
              errBox.textContent = `${f.label} is required`;
              el.classList.add('invalid');
              el.focus();
              return false;
            }
            values[f.name] = v;
          }
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            await onSubmit(values);
            return true;
          } catch (err) {
            errBox.textContent = window.components.errorText(err);
            btn.disabled = false;
            return false;
          }
        },
      },
    ],
  });
};

/** Turn an API error into a user-actionable sentence. */
window.components.errorText = function (err) {
  if (!err) return 'Something went wrong.';
  const details = Array.isArray(err.details) && err.details.length
    ? ' ' + err.details.map(d => d.message || d.reason || '').filter(Boolean).join('; ') : '';
  const hints = {
    NETWORK_ERROR: 'Cannot reach the portal server. Check your connection and retry.',
    TEAM_C_UNAVAILABLE: 'The placement database is unavailable right now. Please retry in a moment.',
    INVALID_TRANSITION: 'That action is not allowed from the application current stage.',
    FORBIDDEN: 'You do not have permission to do that.',
    UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  };
  return (hints[err.code] || err.message || 'Request failed') + (hints[err.code] ? '' : details);
};

/** Run an async action behind a button: disables it, toasts success/error, and refreshes the view. */
window.components.runAction = async function (btn, fn, { success, refresh } = {}) {
  if (btn) btn.disabled = true;
  try {
    const out = await fn();
    if (success) window.toast.success(typeof success === 'function' ? success(out) : success);
    if (refresh) await refresh();
    return out;
  } catch (err) {
    window.toast.error(window.components.errorText(err));
    return null;
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.components.confirm = function ({ title, message, confirmText = 'Confirm', danger = false, onConfirm }) {
  window.modal.confirm({ title, message, confirmText, confirmClass: danger ? 'btn-danger' : 'btn-primary', onConfirm });
};

/** Debounce helper for search boxes. */
window.debounce = function (fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/** Tiny accessible tab switcher: tabs = [{id,label}], renders into container returned by callback. */
window.components.tabs = function (tabs, active) {
  return `<div class="tabs" role="tablist">${tabs.map(t => `<button class="tab ${t.id === active ? 'active' : ''}" role="tab" aria-selected="${t.id === active}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>`;
};

const RULE_LABEL = { CGPA: 'CGPA', BACKLOGS: 'Active backlogs', BRANCH: 'Branch', ATTENDANCE: 'Attendance', SKILLS: 'Skills' };

/** Eligibility decision from Team A: verdict, per-rule breakdown, and engine metadata. */
window.components.eligibilityBreakdown = function (ev) {
  if (!ev) return '';
  const rows = (ev.criteria_breakdown && ev.criteria_breakdown.length)
    ? ev.criteria_breakdown.map(r => `<tr><td><b>${esc(RULE_LABEL[r.rule] || r.rule)}</b>${r.hard === false ? ' <span class="muted small">(soft)</span>' : ''}</td><td>${esc(r.required)}</td><td>${esc(r.actual)}</td><td>${r.passed ? '<span class="badge badge-eligible">Pass</span>' : '<span class="badge badge-not_eligible">Fail</span>'}</td></tr>`).join('')
    : [...(ev.passed_rules || []).map(t => `<tr><td colspan="3">${esc(t)}</td><td><span class="badge badge-eligible">Pass</span></td></tr>`),
       ...(ev.failed_rules || []).map(t => `<tr><td colspan="3">${esc(t)}</td><td><span class="badge badge-not_eligible">Fail</span></td></tr>`)].join('');
  const m = ev.decision_metrics || {};
  return `
    <div class="row between" style="margin-bottom:.75rem;">
      <div class="row">${window.components.renderEligibilityBadge(ev.eligibility_result)}
        <span class="small muted">${ev.strategy ? esc(String(ev.strategy).replace(/_/g, ' ')) : ''} · rule set v${esc(ev.rule_set_version || '—')}${m.evaluation_time_us !== undefined ? ` · ${m.evaluation_time_us} µs` : ''}</span></div>
      ${ev.source === 'MOCK_FALLBACK' ? '<span class="chip amber">local fallback</span>' : window.components.teamTag('A', 'rule engine')}
    </div>
    <div class="table-responsive"><table class="data-table"><thead><tr><th>Rule</th><th>Requirement</th><th>Your value</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${(ev.failed_rules || []).length ? `<ul class="small" style="margin:.75rem 0 0 1.1rem;color:var(--text-secondary);">${ev.failed_rules.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}`;
};

window.components.appLink = function (app, label) {
  const role = window.store.get('user')?.role;
  return role === 'student' ? `<a class="link" href="#/student/applications/${esc(app.application_id)}">${label || 'View'}</a>` : '';
};
