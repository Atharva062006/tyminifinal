/**
 * Student dashboard: next steps, KPIs, upcoming interviews, offers, applications, announcements.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderDashboard = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');
  const d = await window.api.getDashboard();
  const k = d.kpis || {};
  const first = esc((d.student?.name || user.name || '').split(' ')[0]);

  const apps = (d.recent_applications || []).map(a => `
    <tr>
      <td><b>${esc(a.drive_title)}</b><br><span class="muted small">${esc(a.company_name)}</span></td>
      <td>${window.components.renderBadge(a.state)}</td>
      <td>${a.rank ? `<span class="rank-no ${a.rank <= 3 ? 'top' : ''}" title="Rank among ${a.rank_pool || '?'} eligible applicants">${a.rank}</span>` : '<span class="muted">—</span>'}</td>
      <td class="right"><a class="link" href="#/student/applications/${esc(a.application_id)}">Track →</a></td>
    </tr>`).join('');

  c.innerHTML = `
    <section class="hero">
      <div>
        <h1>Welcome back, ${first} 👋</h1>
        <p>${d.student ? `${esc(d.student.branch)} · CGPA ${esc(d.student.cgpa)} ${d.student.academic_verified ? '· academics verified ✓' : '· academics pending verification by the placement cell'}` : 'Complete your profile to get ranked for drives.'}</p>
        <div style="margin-top:.7rem;">${window.components.teamTags([['C', 'your records'], ['A', 'eligibility'], ['B', 'ranking']])}</div>
      </div>
      <div class="hero-side">
        <a class="btn btn-primary" href="#/student/drives">Browse open drives</a>
        <a class="btn btn-secondary" href="#/student/profile">Update profile</a>
      </div>
    </section>

    <div class="kpi-grid">
      ${window.components.kpi({ label: 'Applications', value: k.total_applications, meta: 'submitted so far' })}
      ${window.components.kpi({ label: 'Shortlisted+', value: k.shortlisted_count, meta: 'reached shortlist or beyond', tone: 'purple' })}
      ${window.components.kpi({ label: 'Upcoming interviews', value: k.interviews_count, tone: 'amber' })}
      ${window.components.kpi({ label: 'Offers', value: k.offers_count, tone: 'green' })}
      ${window.components.kpi({ label: 'Open drives', value: k.available_drives_count, tone: 'cyan' })}
    </div>

    <div class="grid split">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>My applications</h3><a class="link small" href="#/student/applications">View all</a></div>
          ${apps ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Drive</th><th>Status</th><th>Rank</th><th></th></tr></thead><tbody>${apps}</tbody></table></div>`
            : window.components.emptyState('No applications yet', 'Browse open drives and apply — your eligibility is checked automatically.', '<a class="btn btn-primary btn-sm" href="#/student/drives">Find a drive</a>')}
        </div>
        <div class="card">
          <div class="card-head"><h3>Open drives</h3><a class="link small" href="#/student/drives">See all</a></div>
          <div class="drive-grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));">
            ${(d.open_drives || []).map(dr => `
              <a class="drive-card" href="#/student/drives/${esc(dr.drive_id)}" style="text-decoration:none;color:inherit;">
                <div class="co">${window.components.companyLogo(dr.company?.name)}<div><h3>${esc(dr.title)}</h3><span class="muted small">${esc(dr.company?.name || '')}</span></div></div>
                <div class="facts"><span class="fact">${esc(fmt.money(dr.package))}</span><span class="fact">${esc(dr.seats)} seats left</span>${dr.applied ? '<span class="fact" style="background:#dcfce7;color:#166534;">Applied</span>' : ''}</div>
              </a>`).join('') || '<p class="muted">No open drives right now.</p>'}
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card"><div class="card-head"><h3>Your next steps</h3></div>
          ${(d.todo || []).length ? `<ul class="todo-list">${d.todo.map(t => `<li><a class="link" href="${t.href}">${esc(t.text)}</a></li>`).join('')}</ul>` : '<p class="sub">Nothing pending — you are all set. 🎉</p>'}
        </div>
        ${(d.pending_offers || []).length ? `<div class="card" style="border-top:3px solid var(--accent-emerald);"><div class="card-head"><h3>Offer awaiting your decision</h3></div>
          ${d.pending_offers.map(o => `<div class="list-item"><div><b>${esc(o.company_name || o.drive_title)}</b><div class="muted small">${esc(o.drive_title || '')} · ${esc(fmt.money(o.package_ctc))}</div></div><a class="btn btn-success btn-sm" href="#/student/offers">Respond</a></div>`).join('')}</div>` : ''}
        <div class="card"><div class="card-head"><h3>Upcoming interviews</h3><a class="link small" href="#/student/interviews">All</a></div>
          ${(d.upcoming_interviews || []).map(i => `<div class="list-item"><div><b>${esc(i.round_name)}</b><div class="muted small">${esc(i.company_name || '')} · ${esc(i.drive_title || '')}</div></div><div class="right small"><b>${esc(fmt.dateTime(i.scheduled_at))}</b><br>${esc(i.mode || '')}</div></div>`).join('') || '<p class="sub">No interviews scheduled.</p>'}
        </div>
        <div class="card"><div class="card-head"><h3>Announcements</h3>${window.components.teamTag('C')}</div>
          ${(d.announcements || []).map(a => `<div class="list-item" style="display:block;"><b>${esc(a.title)}</b><div class="sub small">${esc(a.content)}</div><div class="muted small">${esc(fmt.ago(a.created_at))} · ${esc(a.author)}</div></div>`).join('') || '<p class="sub">No announcements.</p>'}
        </div>
      </div>
    </div>`;
};
