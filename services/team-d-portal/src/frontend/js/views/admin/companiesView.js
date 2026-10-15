/**
 * Company directory (staff): add and edit recruiting companies.
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderCompanies = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const [companies, drives] = await Promise.all([window.api.getCompanies(), window.api.getDrives()]);

  const form = (co) => window.components.formModal({
    title: co ? `Edit ${co.name}` : 'Add company', submitText: co ? 'Save' : 'Add company',
    fields: [
      { name: 'name', label: 'Company name', value: co?.name || '', required: true, full: true },
      { name: 'industry', label: 'Industry', value: co?.industry || '' },
      { name: 'website', label: 'Website', type: 'url', value: co?.website || '' },
      { name: 'description', label: 'About', type: 'textarea', value: co?.description || '', full: true },
    ],
    onSubmit: async (v) => {
      const payload = { name: v.name, industry: v.industry || undefined, website: v.website || undefined, description: v.description || undefined };
      if (co) await window.api.updateCompany(co.company_id, payload); else await window.api.createCompany(payload);
      window.toast.success(co ? 'Company updated' : 'Company added');
      window.views.admin.renderCompanies();
    },
  });

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Companies', subtitle: 'Recruiters participating in the placement season.',
      tags: [['C', 'company master data']], actions: '<button class="btn btn-primary" id="add-co">+ Add company</button>',
    })}
    ${companies.length ? `<div class="drive-grid">${companies.map(co => {
      const ds = drives.filter(d => d.company_id === co.company_id);
      return `<div class="drive-card"><div class="co">${window.components.companyLogo(co.name)}<div style="min-width:0;"><h3>${esc(co.name)}</h3><span class="muted small">${esc(co.industry || 'Industry not set')}</span></div></div>
        <p class="sub small">${esc(co.description || '')}</p>
        <div class="facts"><span class="fact">${ds.length} drive${ds.length === 1 ? '' : 's'}</span><span class="fact">${ds.filter(d => d.state === 'OPEN').length} open</span>${co.website ? `<a class="fact" href="${esc(co.website)}" target="_blank" rel="noopener">website ↗</a>` : ''}</div>
        <div class="row between"><span class="mono small muted">${esc(co.company_id)}</span><button class="btn btn-secondary btn-sm" data-edit="${esc(co.company_id)}">Edit</button></div></div>`;
    }).join('')}</div>` : window.components.emptyState('No companies yet', 'Add the first recruiting company.')}`;

  document.getElementById('add-co').addEventListener('click', () => form(null));
  c.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => form(companies.find(x => x.company_id === b.dataset.edit))));
};
