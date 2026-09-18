/**
 * Enhanced RIT Institutional Placement Portal Login & Persona Switcher View.
 * Premium Glassmorphism Design Theme with Interactive Role Filtering & Custom Login.
 */

window.views = window.views || {};

window.views.renderLoginView = function() {
  const personas = [
    {
      id: 'STU001',
      role: 'student',
      name: 'Aarav Sharma',
      detail: 'CSE • CGPA 8.9 • 0 Backlogs',
      badge: 'High Eligibility',
      badgeClass: 'badge-open',
      accent: 'var(--rit-blue)'
    },
    {
      id: 'STU002',
      role: 'student',
      name: 'Rohan Patil',
      detail: 'CSE • CGPA 7.4 • 1 Backlog',
      badge: 'Conditional',
      badgeClass: 'badge-waitlisted',
      accent: 'var(--accent-cyan)'
    },
    {
      id: 'STU003',
      role: 'student',
      name: 'Ananya Mehta',
      detail: 'IT • CGPA 9.1 • 0 Backlogs',
      badge: 'Full Match',
      badgeClass: 'badge-selected',
      accent: 'var(--accent-purple)'
    },
    {
      id: 'FAC001',
      role: 'faculty',
      name: 'Prof. Rajesh Kulkarni',
      detail: 'Training & Placement Officer (TPO)',
      badge: 'Faculty Admin',
      badgeClass: 'badge-applied',
      accent: 'var(--accent-emerald)'
    },
    {
      id: 'ADM001',
      role: 'admin',
      name: 'Prof. Suresh Deshmukh',
      detail: 'System Administrator & Audit Manager',
      badge: 'Super Admin',
      badgeClass: 'badge-open',
      accent: 'var(--accent-amber)'
    }
  ];

  const personaCardsHtml = personas.map(p => `
    <div class="persona-card-item" data-role="${p.role}">
      <button class="persona-btn" data-id="${p.id}" data-role="${p.role}" style="
        text-align: left;
        padding: 1.1rem 1.25rem;
        cursor: pointer;
        border-left: 4px solid ${p.accent};
        width: 100%;
        background: #ffffff;
        border-radius: var(--radius-md);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid var(--border-color);
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        position: relative;
        overflow: hidden;
      ">
        <div style="display: flex; align-items: center; gap: 1rem; position: relative; z-index: 2;">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: ${p.accent}12;
            border: 1px solid ${p.accent}30;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            font-weight: 800;
            color: ${p.accent};
            flex-shrink: 0;
          ">${p.name.charAt(0)}</div>
          <div>
            <div style="font-weight: 800; font-size: 1.05rem; color: var(--rit-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${p.name}
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
              <span class="badge" style="background: #eff6ff; color: ${p.accent}; border: 1px solid ${p.accent}40; font-size: 0.65rem; padding: 0.15rem 0.5rem; font-weight: 700;">${p.role.toUpperCase()} • ${p.id}</span>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${p.detail}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; position: relative; z-index: 2;">
          <span class="badge ${p.badgeClass}" style="font-size: 0.7rem;">${p.badge}</span>
        </div>
      </button>
    </div>
  `).join('');

  return `
    <div class="auth-hero-container" style="
      min-height: 100vh;
      background: radial-gradient(circle at 10% 20%, #0b192e 0%, #0f2b5c 50%, #1e3a8a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      position: relative;
      overflow: hidden;
    ">
      
      <!-- Background Ambient Glow Accents -->
      <div style="position: absolute; top: -10%; left: -5%; width: 450px; height: 450px; background: rgba(29, 78, 216, 0.25); filter: blur(120px); border-radius: 50%; pointer-events: none;"></div>
      <div style="position: absolute; bottom: -10%; right: -5%; width: 500px; height: 500px; background: rgba(2, 132, 199, 0.2); filter: blur(140px); border-radius: 50%; pointer-events: none;"></div>

      <div style="max-width: 1140px; width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 3rem; align-items: center; position: relative; z-index: 10;">
        
        <!-- Left Hero Branding & System Telemetry -->
        <div style="color: #ffffff;">
          
          <!-- RIT Badge Header -->
          <div style="display: inline-flex; align-items: center; gap: 0.85rem; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); padding: 0.5rem 1.1rem; border-radius: var(--radius-full); margin-bottom: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <img src="assets/logo.jpg" alt="RIT Logo" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain; background: #ffffff; padding: 2px;" />
            <span style="font-size: 0.88rem; font-weight: 700; letter-spacing: 0.03em; color: #f8fafc;">Rajarambapu Institute of Technology</span>
            <span style="background: var(--accent-emerald); color: #ffffff; font-size: 0.65rem; padding: 0.15rem 0.5rem; border-radius: 10px; font-weight: 800;">NAAC A+</span>
          </div>

          <h1 style="font-size: 3rem; line-height: 1.15; font-weight: 900; margin-bottom: 1.25rem; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
            Campus Placement & Eligibility Portal
          </h1>

          <p style="color: #cbd5e1; font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.7; max-width: 500px;">
            Welcome to the Rajarambapu Institute of Technology Campus Placement Portal. Select your portal persona to proceed.
          </p>

        </div>

        <!-- Right Login Panel (Persona Switcher & Custom Login) -->
        <div class="card" style="
          padding: 2.25rem;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid var(--border-color);
          box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.35);
        ">
          
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--rit-navy);">
                Institutional Portal Access
              </h2>
              <span class="badge badge-open" style="font-size: 0.7rem;">Select Persona</span>
            </div>
            <p style="font-size: 0.88rem; color: var(--text-secondary);">
              Choose a pre-configured account or log in with custom student/faculty ID:
            </p>
          </div>

          <!-- Role Filter Tabs -->
          <div style="display: flex; gap: 0.4rem; background: var(--bg-tertiary); padding: 0.35rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; border: 1px solid var(--border-color); flex-wrap: wrap;">
            <button class="role-tab-btn active" data-filter="all" style="flex: 1; padding: 0.45rem 0.65rem; border: none; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 700; cursor: pointer; background: #ffffff; color: var(--rit-navy); box-shadow: var(--shadow-sm); transition: all 0.15s ease;">
              All (5)
            </button>
            <button class="role-tab-btn" data-filter="student" style="flex: 1; padding: 0.45rem 0.65rem; border: none; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: var(--text-secondary); transition: all 0.15s ease;">
              Students
            </button>
            <button class="role-tab-btn" data-filter="faculty" style="flex: 1; padding: 0.45rem 0.65rem; border: none; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: var(--text-secondary); transition: all 0.15s ease;">
              Faculty
            </button>
            <button class="role-tab-btn" data-filter="admin" style="flex: 1; padding: 0.45rem 0.65rem; border: none; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: var(--text-secondary); transition: all 0.15s ease;">
              Admin
            </button>
            <button class="role-tab-btn" data-filter="custom" style="flex: 1; padding: 0.45rem 0.65rem; border: none; border-radius: var(--radius-sm); font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: var(--text-secondary); transition: all 0.15s ease;">
              Custom ID
            </button>
          </div>

          <!-- Persona Cards List Container -->
          <div id="persona-list-container" style="display: flex; flex-direction: column; gap: 0.85rem; max-height: 380px; overflow-y: auto; padding-right: 0.25rem; margin-bottom: 1.5rem;">
            ${personaCardsHtml}
          </div>

          <!-- Custom Login Box (Initially hidden) -->
          <div id="custom-login-box" style="display: none; background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700; color: var(--rit-navy); font-size: 0.85rem;">Account Role</label>
              <select id="custom-role-input" class="form-control">
                <option value="student">Student</option>
                <option value="faculty">Faculty / TPO</option>
                <option value="admin">Placement Admin</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700; color: var(--rit-navy); font-size: 0.85rem;">User ID (e.g. STU004, FAC002, ADM002)</label>
              <input type="text" id="custom-id-input" class="form-control" placeholder="Enter User ID..." value="STU004" />
            </div>
            <button id="custom-login-submit-btn" class="btn btn-primary" style="width: 100%; background: var(--rit-blue); justify-content: center; font-weight: 700;">
              Login with Custom ID
            </button>
          </div>

          <!-- RIT Footer Branding -->
          <div style="text-align: center; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
            Rajarambapu Institute of Technology, Rajaramnagar • Placement Cell
          </div>

        </div>

      </div>
    </div>
  `;
};

window.views.bindLoginEvents = function() {
  // Role Filter Tab Switchers
  const tabBtns = document.querySelectorAll('.role-tab-btn');
  const personaItems = document.querySelectorAll('.persona-card-item');
  const personaContainer = document.getElementById('persona-list-container');
  const customBox = document.getElementById('custom-login-box');

  tabBtns.forEach(tab => {
    tab.addEventListener('click', () => {
      tabBtns.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = 'var(--text-secondary)';
        t.style.boxShadow = 'none';
      });

      tab.classList.add('active');
      tab.style.background = '#ffffff';
      tab.style.color = 'var(--rit-navy)';
      tab.style.boxShadow = 'var(--shadow-sm)';

      const filter = tab.getAttribute('data-filter');

      if (filter === 'custom') {
        personaContainer.style.display = 'none';
        customBox.style.display = 'block';
      } else {
        customBox.style.display = 'none';
        personaContainer.style.display = 'flex';

        personaItems.forEach(item => {
          const role = item.getAttribute('data-role');
          if (filter === 'all' || role === filter) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      }
    });
  });

  // Persona Quick Login Buttons
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = 'var(--shadow-hover)';
      btn.style.borderColor = 'var(--rit-blue)';
      const arrow = btn.querySelector('.arrow-icon');
      if (arrow) arrow.style.transform = 'translateX(4px)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = 'var(--shadow-sm)';
      btn.style.borderColor = 'var(--border-color)';
      const arrow = btn.querySelector('.arrow-icon');
      if (arrow) arrow.style.transform = 'none';
    });

    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const role = btn.getAttribute('data-role');

      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';

      try {
        await window.api.login(role, id);
        window.toast.success(`Logged in successfully as ${id}`);
        window.sseClient.connect();

        if (role === 'admin') window.location.hash = '#/admin/dashboard';
        else if (role === 'faculty') window.location.hash = '#/faculty/dashboard';
        else window.location.hash = '#/student/dashboard';
      } catch (err) {
        window.toast.error(err.message || 'Login failed');
      } finally {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
    });
  });

  // Custom ID Login Submit Button
  const customSubmitBtn = document.getElementById('custom-login-submit-btn');
  if (customSubmitBtn) {
    customSubmitBtn.addEventListener('click', async () => {
      const role = document.getElementById('custom-role-input')?.value || 'student';
      const userId = document.getElementById('custom-id-input')?.value?.trim();

      if (!userId) {
        window.toast.error('Please enter a valid User ID');
        return;
      }

      customSubmitBtn.disabled = true;
      customSubmitBtn.textContent = 'Authenticating...';

      try {
        await window.api.login(role, userId);
        window.toast.success(`Authenticated as ${userId}`);
        window.sseClient.connect();

        if (role === 'admin') window.location.hash = '#/admin/dashboard';
        else if (role === 'faculty') window.location.hash = '#/faculty/dashboard';
        else window.location.hash = '#/student/dashboard';
      } catch (err) {
        window.toast.error(err.message || 'Custom authentication failed');
      } finally {
        customSubmitBtn.disabled = false;
        customSubmitBtn.textContent = 'Login with Custom ID';
      }
    });
  }
};
