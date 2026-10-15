/**
 * Student offers: review issued offers and accept / decline (committed atomically in Team C).
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderOffers = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const offers = (await window.api.getOffers()).filter(o => o.status !== 'COMPENSATED');
  const open = offers.filter(o => o.status === 'COMMITTED');
  const pending = offers.filter(o => o.status === 'PENDING');
  const done = offers.filter(o => ['ACCEPTED', 'DECLINED'].includes(o.status));

  const card = (o, actionable) => `
    <div class="card" style="border-top:3px solid ${o.status === 'ACCEPTED' ? 'var(--accent-emerald)' : o.status === 'DECLINED' ? '#cbd5e1' : 'var(--rit-blue)'};">
      <div class="row between"><div class="row">${window.components.companyLogo(o.company_name)}<div><h3 style="font-size:1.05rem;">${esc(o.company_name || 'Company')}</h3><div class="muted small">${esc(o.role_title || o.drive_title || '')}</div></div></div>${window.components.renderBadge(o.status)}</div>
      <div style="font-size:1.7rem;font-weight:800;color:var(--rit-navy);margin:.9rem 0 .2rem;">${esc(fmt.money(o.package_ctc))}</div>
      <dl class="kv small"><dt>Joining</dt><dd>${esc(o.joining_date ? fmt.date(o.joining_date) : 'To be confirmed')}</dd><dt>Issued</dt><dd>${esc(fmt.date(o.committed_at || o.created_at))}</dd></dl>
      ${actionable ? `<div class="row" style="margin-top:1rem;"><button class="btn btn-success" data-accept="${esc(o.application_id)}" data-name="${esc(o.company_name)}">Accept offer</button><button class="btn btn-outline-danger" data-decline="${esc(o.application_id)}" data-name="${esc(o.company_name)}">Decline</button><a class="link small" href="#/student/applications/${esc(o.application_id)}">Details</a></div>` : ''}
    </div>`;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Offers', subtitle: 'Respond to your placement offers. A decision is final and is recorded in the audit trail.',
      tags: [['C', 'offer commit & seats']],
    })}
    ${open.length ? `<div class="alert info"><div><b>${open.length} offer${open.length > 1 ? 's' : ''} waiting for your decision.</b> Accepting is final; declining returns the seat to the drive.</div></div>
      <div class="grid cols-2" style="margin-bottom:1.5rem;">${open.map(o => card(o, true)).join('')}</div>` : ''}
    ${pending.length ? `<h3 style="margin-bottom:.7rem;">Selected — offer letter being prepared</h3><div class="grid cols-2" style="margin-bottom:1.5rem;">${pending.map(o => `<div class="card"><b>${esc(o.company_name || o.drive_title)}</b><p class="sub small" style="margin-top:.3rem;">You have been selected. The placement cell will issue the formal offer shortly.</p>${window.components.renderBadge('SELECTED')}</div>`).join('')}</div>` : ''}
    ${done.length ? `<h3 style="margin-bottom:.7rem;">Previous decisions</h3><div class="grid cols-2">${done.map(o => card(o, false)).join('')}</div>` : ''}
    ${!offers.length ? window.components.emptyState('No offers yet', 'Offers appear here once a company selects you and the placement cell issues the letter.', '<a class="btn btn-secondary btn-sm" href="#/student/applications">Track applications</a>') : ''}`;

  const decide = (btn, decision, verb) => window.components.confirm({
    title: `${verb} this offer?`,
    message: decision === 'ACCEPT' ? `You are accepting the offer from ${btn.dataset.name}. This cannot be undone.` : `You are declining the offer from ${btn.dataset.name}. The seat is released to other candidates.`,
    confirmText: verb, danger: decision === 'DECLINE',
    onConfirm: () => window.components.runAction(null, () => window.api.submitOfferDecision(btn.dataset.accept || btn.dataset.decline, decision), { success: decision === 'ACCEPT' ? 'Offer accepted — congratulations! 🎉' : 'Offer declined', refresh: () => window.views.student.renderOffers() }),
  });
  c.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', () => decide(b, 'ACCEPT', 'Accept')));
  c.querySelectorAll('[data-decline]').forEach(b => b.addEventListener('click', () => decide(b, 'DECLINE', 'Decline')));
};
