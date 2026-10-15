/**
 * Sign-in and student registration pages (Team D UI → Team C accounts).
 */
window.views = window.views || {};

const DEMO = [
  { label: 'Student — Aarav Sharma (CSE, shortlisted)', email: 'aarav@rit.edu', pw: 'student123' },
  { label: 'Student — Ananya Mehta (IT, has an offer)', email: 'ananya@rit.edu', pw: 'student123' },
  { label: 'Faculty / TPO — Prof. Kulkarni', email: 'tpo@rit.edu', pw: 'faculty123' },
  { label: 'Placement Admin — Prof. Deshmukh', email: 'admin@rit.edu', pw: 'admin123' },
  { label: 'Auditor — Meera Iyer', email: 'auditor@rit.edu', pw: 'auditor123' },
];

function authHero() {
  return `
    <section class="auth-hero" aria-label="About the portal">
      <div class="row" style="gap:.8rem;">
        <div class="brand-logo-img" style="width:52px;height:52px;"><img src="assets/logo.jpg" alt="RIT logo"/></div>
        <div><b style="font-size:1.05rem;">Rajarambapu Institute of Technology</b><div style="font-size:.72rem;color:#93c5fd;letter-spacing:.08em;text-transform:uppercase;">Training &amp; Placement Cell</div></div>
      </div>
      <h1>Campus Placement &amp; Eligibility Portal</h1>
      <p>Discover drives, see instantly whether you are eligible, track your application and respond to offers — all in one place.</p>
      <div class="pillars">
        <div class="pillar"><span class="tick">✓</span><div><b>Rule-based eligibility</b>CGPA, backlogs, branch, attendance and skills evaluated by the OS engine with fair queueing. ${window.components.teamTag('A')}</div></div>
        <div class="pillar"><span class="tick">✓</span><div><b>Transparent ranking</b>Skill-graph scoring with reproducible, versioned results. ${window.components.teamTag('B')}</div></div>
        <div class="pillar"><span class="tick">✓</span><div><b>Trustworthy records</b>ACID database, audit trail and no double bookings. ${window.components.teamTag('C')}</div></div>
      </div>
    </section>`;
}

window.views.renderLoginView = function () {
  return `
    <div class="auth-wrap">
      ${authHero()}
      <div class="auth-panel">
        <div class="auth-card">
          <h2>Sign in</h2>
          <p class="sub" style="margin-bottom:1.25rem;">Use your institute e-mail and password.</p>
          <form id="login-form" novalidate>
            <div class="form-group" style="margin-bottom:.9rem;">
              <label for="login-email">E-mail</label>
              <input id="login-email" class="form-control" type="email" autocomplete="username" placeholder="you@rit.edu" required />
            </div>
            <div class="form-group" style="margin-bottom:.4rem;">
              <label for="login-password">Password</label>
              <input id="login-password" class="form-control" type="password" autocomplete="current-password" required />
            </div>
            <div id="login-error" class="form-error" role="alert" style="min-height:1.2rem;"></div>
            <button id="login-submit" class="btn btn-primary" style="width:100%;margin-top:.5rem;" type="submit">Sign in</button>
          </form>
          <p class="sub" style="text-align:center;margin-top:1rem;">New student? <a class="link" href="#/register">Create your account</a></p>
          <hr class="divider"/>
          <details>
            <summary class="small muted" style="cursor:pointer;">Demo accounts (for evaluation)</summary>
            <div class="demo-list">${DEMO.map(d => `<button type="button" class="demo-btn" data-email="${d.email}" data-pw="${d.pw}"><span>${esc(d.label)}</span><span class="muted mono">${d.email}</span></button>`).join('')}</div>
          </details>
          <div style="margin-top:1rem;text-align:center;">${window.components.teamTag('C', 'accounts & sessions')} ${window.components.teamTag('D', 'portal')}</div>
        </div>
      </div>
    </div>`;
};

window.views.bindLoginEvents = function () {
  const form = document.getElementById('login-form');
  const err = document.getElementById('login-error');
  document.querySelectorAll('.demo-btn').forEach(b => b.addEventListener('click', () => {
    document.getElementById('login-email').value = b.dataset.email;
    document.getElementById('login-password').value = b.dataset.pw;
    form.requestSubmit();
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;
    if (!email || !pw) { err.textContent = 'Enter your e-mail and password.'; return; }
    const btn = document.getElementById('login-submit');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const data = await window.api.login(email, pw);
      window.__unreadLoaded = false;
      window.store.set('user', data.user);
      window.location.hash = window.components.homeFor(data.user.role);
    } catch (ex) {
      err.textContent = window.components.errorText(ex);
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
};

window.views.renderRegisterView = function () {
  const branches = ['CSE', 'IT', 'ENTC', 'MECH', 'CIVIL', 'ELECTRICAL'];
  return `
    <div class="auth-wrap">
      ${authHero()}
      <div class="auth-panel">
        <div class="auth-card" style="max-width:560px;">
          <h2>Create student account</h2>
          <p class="sub" style="margin-bottom:1.1rem;">Your academic details are checked by the placement cell. You can update them later from your profile.</p>
          <form id="register-form" class="form-grid" novalidate>
            <div class="form-group full"><label for="r-name">Full name *</label><input id="r-name" class="form-control" required autocomplete="name"/></div>
            <div class="form-group full"><label for="r-email">Institute e-mail *</label><input id="r-email" type="email" class="form-control" required autocomplete="email" placeholder="you@rit.edu"/></div>
            <div class="form-group"><label for="r-pw">Password *</label><input id="r-pw" type="password" class="form-control" minlength="6" required autocomplete="new-password"/><div class="form-help">Minimum 6 characters</div></div>
            <div class="form-group"><label for="r-pw2">Confirm password *</label><input id="r-pw2" type="password" class="form-control" required autocomplete="new-password"/></div>
            <div class="form-group"><label for="r-branch">Branch *</label><select id="r-branch" class="form-control">${branches.map(b => `<option>${b}</option>`).join('')}</select></div>
            <div class="form-group"><label for="r-year">Year</label><select id="r-year" class="form-control"><option value="4">Final year</option><option value="3">Third year</option></select></div>
            <div class="form-group"><label for="r-cgpa">CGPA *</label><input id="r-cgpa" type="number" step="0.01" min="0" max="10" class="form-control" required/></div>
            <div class="form-group"><label for="r-backlogs">Active backlogs *</label><input id="r-backlogs" type="number" min="0" value="0" class="form-control" required/></div>
            <div class="form-group"><label for="r-att">Attendance %</label><input id="r-att" type="number" min="0" max="100" value="80" class="form-control"/></div>
            <div class="form-group"><label for="r-skills">Skills</label><input id="r-skills" class="form-control" placeholder="Python, SQL, React"/><div class="form-help">Comma separated</div></div>
            <div class="full"><div id="register-error" class="form-error" role="alert" style="min-height:1.2rem;"></div>
              <button id="register-submit" class="btn btn-primary" style="width:100%;" type="submit">Create account &amp; sign in</button></div>
          </form>
          <p class="sub" style="text-align:center;margin-top:1rem;">Already registered? <a class="link" href="#/login">Sign in</a></p>
          <div style="margin-top:.75rem;text-align:center;">${window.components.teamTag('C', 'student record + account')}</div>
        </div>
      </div>
    </div>`;
};

window.views.bindRegisterEvents = function () {
  const form = document.getElementById('register-form');
  const err = document.getElementById('register-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const v = (id) => document.getElementById(id).value.trim();
    if (v('r-pw') !== document.getElementById('r-pw2').value) { err.textContent = 'Passwords do not match.'; return; }
    if (!v('r-name') || !v('r-email') || !v('r-cgpa')) { err.textContent = 'Name, e-mail and CGPA are required.'; return; }
    const btn = document.getElementById('register-submit');
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      const data = await window.api.register({
        name: v('r-name'), email: v('r-email'), password: v('r-pw'), branch: v('r-branch'), year: v('r-year'),
        cgpa: Number(v('r-cgpa')), backlogs: Number(v('r-backlogs') || 0), attendance: Number(v('r-att') || 80),
        skills: v('r-skills').split(',').map(s => s.trim()).filter(Boolean),
      });
      window.__unreadLoaded = false;
      window.store.set('user', data.user);
      window.toast.success('Welcome to the RIT Placement Portal!');
      window.location.hash = '#/student/profile';
    } catch (ex) {
      const d = (ex.details || []).map(x => x.message).filter(Boolean).join('; ');
      err.textContent = (ex.message || 'Registration failed') + (d ? ` — ${d}` : '');
      btn.disabled = false; btn.textContent = 'Create account & sign in';
    }
  });
};
