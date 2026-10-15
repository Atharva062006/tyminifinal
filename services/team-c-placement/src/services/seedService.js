/**
 * SeedService — deterministic demo data inserted through the DBMS itself (schema + FK validated).
 * Runs automatically when the database is empty (disable with AUTO_SEED=false).
 * Demo logins (see README): students use <email> / student123, faculty tpo@rit.edu / faculty123,
 * admin admin@rit.edu / admin123, auditor auditor@rit.edu / auditor123.
 */

const day = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

const STUDENTS = [
  { student_id: 'STU001', name: 'Aarav Sharma', email: 'aarav@rit.edu', branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, year: 4, skills: ['JavaScript', 'Python', 'SQL'], phone: '9876500001', about: 'Final-year CSE student interested in full-stack development.', github_url: 'https://github.com/aarav-sharma', projects: [{ title: 'Campus Connect', description: 'Event discovery web app', link: 'https://github.com/aarav-sharma/campus-connect' }], certifications: [{ title: 'AWS Cloud Practitioner', issuer: 'Amazon' }], academic_verified: true },
  { student_id: 'STU002', name: 'Rohan Patil', email: 'rohan@rit.edu', branch: 'CSE', cgpa: 7.4, backlogs: 1, attendance: 75, year: 4, skills: ['Java', 'Spring', 'MySQL'], phone: '9876500002', projects: [], certifications: [], academic_verified: true },
  { student_id: 'STU003', name: 'Ananya Mehta', email: 'ananya@rit.edu', branch: 'IT', cgpa: 9.1, backlogs: 0, attendance: 92, year: 4, skills: ['React', 'Node.js', 'MongoDB', 'Python', 'SQL'], phone: '9876500003', projects: [{ title: 'ShopSmart', description: 'MERN e-commerce platform' }, { title: 'Chatterbox', description: 'Realtime chat' }], certifications: [{ title: 'Meta Front-End Developer', issuer: 'Coursera' }], academic_verified: true },
  { student_id: 'STU004', name: 'Devraj Kumar', email: 'devraj@rit.edu', branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 70, year: 4, skills: ['C++', 'DSA'], projects: [], certifications: [], academic_verified: true },
  { student_id: 'STU005', name: 'Isha Joshi', email: 'isha@rit.edu', branch: 'ENTC', cgpa: 8.2, backlogs: 0, attendance: 85, year: 4, skills: ['Python', 'ML', 'TensorFlow'], projects: [{ title: 'Signal Classifier', description: 'CNN for modulation recognition' }], certifications: [], academic_verified: true },
  { student_id: 'STU006', name: 'Kabir Shaikh', email: 'kabir@rit.edu', branch: 'IT', cgpa: 7.9, backlogs: 0, attendance: 81, year: 4, skills: ['Java', 'SQL', 'Docker'], projects: [], certifications: [], academic_verified: false },
  { student_id: 'STU007', name: 'Neha Kulkarni', email: 'neha@rit.edu', branch: 'CSE', cgpa: 8.6, backlogs: 0, attendance: 90, year: 4, skills: ['Python', 'SQL', 'AWS'], projects: [{ title: 'Expense Tracker', description: 'Flask + Postgres' }], certifications: [{ title: 'Azure Fundamentals', issuer: 'Microsoft' }], academic_verified: true },
  { student_id: 'STU008', name: 'Omkar Jadhav', email: 'omkar@rit.edu', branch: 'MECH', cgpa: 7.1, backlogs: 1, attendance: 78, year: 4, skills: ['AutoCAD', 'Python'], projects: [], certifications: [], academic_verified: false },
];

const COMPANIES = [
  { company_id: 'COM001', name: 'TechCorp India', industry: 'IT Services', website: 'https://techcorp.in', description: 'Global IT services and consulting.' },
  { company_id: 'COM002', name: 'DataSoft', industry: 'Analytics', website: 'https://datasoft.io', description: 'Data engineering and analytics products.' },
  { company_id: 'COM003', name: 'CloudNine Systems', industry: 'Cloud Infrastructure', website: 'https://cloudnine.example', description: 'Managed cloud and DevOps services.' },
  { company_id: 'COM004', name: 'Infra Dynamics', industry: 'Core Engineering', website: 'https://infradynamics.example', description: 'Industrial automation and infrastructure.' },
  { company_id: 'COM005', name: 'FinEdge Technologies', industry: 'FinTech', website: 'https://finedge.example', description: 'Payments and banking software.' },
];

const crit = (min_cgpa, max_backlogs, branches, min_attendance, required_skills) =>
  JSON.stringify({ min_cgpa, max_backlogs, branches, min_attendance, required_skills });

const DRIVES = [
  { drive_id: 'DRV001', company_id: 'COM001', title: 'SDE Intern 2026', seats: 10, package: 600000, state: 'OPEN', location: 'Pune (Hybrid)', deadline: day(20), description: 'Six-month internship with PPO for full-stack roles.', criteria_json: crit(7.0, 1, ['CSE', 'IT'], 75, ['JavaScript', 'Python']) },
  { drive_id: 'DRV002', company_id: 'COM002', title: 'Data Analyst 2026', seats: 5, package: 750000, state: 'OPEN', location: 'Bengaluru', deadline: day(15), description: 'Analytics and BI role working on customer data products.', criteria_json: crit(8.0, 0, ['CSE', 'IT', 'ENTC'], 80, ['Python', 'SQL']) },
  { drive_id: 'DRV003', company_id: 'COM003', title: 'Cloud Engineer 2026', seats: 4, package: 900000, state: 'OPEN', location: 'Hyderabad', deadline: day(25), description: 'Design and operate cloud platforms.', criteria_json: crit(7.5, 0, ['CSE', 'IT'], 75, ['AWS', 'Docker', 'Python']) },
  { drive_id: 'DRV004', company_id: 'COM004', title: 'Graduate Engineer Trainee', seats: 6, package: 450000, state: 'OPEN', location: 'Kolhapur', deadline: day(30), description: 'Core engineering rotation programme.', criteria_json: crit(6.5, 2, ['MECH', 'ENTC'], 70, ['AutoCAD']) },
  { drive_id: 'DRV005', company_id: 'COM005', title: 'Backend Developer', seats: 3, package: 1200000, state: 'DRAFT', location: 'Mumbai', deadline: day(40), description: 'Payments platform backend (opens soon).', criteria_json: crit(8.0, 0, ['CSE', 'IT'], 80, ['Java', 'SQL']) },
  { drive_id: 'DRV006', company_id: 'COM001', title: 'SDE Intern 2025', seats: 8, package: 550000, state: 'CLOSED', location: 'Pune', deadline: day(-60), description: 'Previous year drive (archived).', criteria_json: crit(7.0, 1, ['CSE', 'IT'], 75, ['JavaScript']) },
];

async function seed({ db, auditService, authService, notificationService, force = false }) {
  if (!force && db.table('students').count() > 0) {
    await authService.ensureAccounts();
    return { seeded: false };
  }

  const now = new Date().toISOString();
  for (const s of STUDENTS) await db.table('students').insert({ ...s, created_at: now, updated_at: now });
  for (const c of COMPANIES) await db.table('companies').insert({ ...c, created_at: now });
  for (const d of DRIVES) {
    await db.table('drives').insert({ ...d, seats_total: d.seats, version: 1, created_at: now, updated_at: now });
  }
  await authService.ensureAccounts();

  // Applications in varied lifecycle states (consistent with seat counters, offers and interviews)
  const mkApp = (n, student_id, drive_id, state, extra = {}) => ({
    application_id: `APP-SEED-${n}`, student_id, drive_id, state, resume_version: 'v1.0', consent: true,
    idempotency_key: `seed-${n}`, version: 1, created_at: day(-10 + n), updated_at: day(-9 + n), pipeline_status: 'EVALUATED', ...extra,
  });
  const decision = (appId, result, failed = []) => ({
    decision_id: `DEC-SEED-${appId.split('-').pop()}`, application_id: appId, result, failed_rules: failed,
    rule_set_version: '1.2.0', metrics: { evaluation_time_us: 180 }, created_at: day(-9), strategy: 'DECISION_TREE',
  });

  const apps = [
    mkApp(1, 'STU001', 'DRV001', 'SHORTLISTED', { eligibility_result: 'ELIGIBLE', rank: 2, rank_score: 0.842, rank_pool: 4, ranking_status: 'OK' }),
    mkApp(2, 'STU003', 'DRV001', 'INTERVIEW_SCHEDULED', { eligibility_result: 'ELIGIBLE', rank: 1, rank_score: 0.931, rank_pool: 4, ranking_status: 'OK' }),
    mkApp(3, 'STU003', 'DRV002', 'OFFER_ISSUED', { eligibility_result: 'ELIGIBLE', rank: 1, rank_score: 0.955, rank_pool: 3, ranking_status: 'OK' }),
    mkApp(4, 'STU002', 'DRV001', 'RULE_EVALUATED', { eligibility_result: 'CONDITIONAL', failed_rules: ['Missing required skills: JavaScript, Python'], rank: 4, rank_score: 0.51, rank_pool: 4, ranking_status: 'OK' }),
    mkApp(5, 'STU004', 'DRV002', 'NOT_ELIGIBLE', { eligibility_result: 'NOT_ELIGIBLE', failed_rules: ['CGPA 6.8 < cutoff 8', 'Backlogs 2 > allowed 0'] }),
    mkApp(6, 'STU005', 'DRV002', 'SELECTED', { eligibility_result: 'ELIGIBLE', rank: 2, rank_score: 0.81, rank_pool: 3, ranking_status: 'OK' }),
    mkApp(7, 'STU007', 'DRV003', 'RULE_EVALUATED', { eligibility_result: 'ELIGIBLE', rank: 1, rank_score: 0.78, rank_pool: 1, ranking_status: 'OK' }),
    mkApp(8, 'STU006', 'DRV001', 'RULE_EVALUATED', { eligibility_result: 'CONDITIONAL', failed_rules: ['Missing required skills: JavaScript, Python'], rank: 3, rank_score: 0.6, rank_pool: 4, ranking_status: 'OK' }),
  ];
  for (const a of apps) {
    await db.table('applications').insert(a);
    if (a.eligibility_result) {
      await db.table('eligibility_decisions').insert(decision(a.application_id, a.eligibility_result, a.failed_rules || []));
      await db.table('applications').update(a.application_id, { decision_id: `DEC-SEED-${a.application_id.split('-').pop()}` });
    }
    await auditService.log({ actor: a.student_id, action: 'CREATE_APPLICATION', tableName: 'applications', recordId: a.application_id, after: a, correlationId: 'seed' });
  }

  await db.table('interviews').insert({
    interview_id: 'INT-SEED-1', application_id: 'APP-SEED-2', student_id: 'STU003', drive_id: 'DRV001', round_name: 'Technical Interview',
    scheduled_at: day(2, 11), mode: 'Online', location_url: 'https://meet.jit.si/rit-techcorp-tech', slot_id: `DRV001@${day(2, 11)}`, status: 'SCHEDULED', created_at: now,
  });
  await db.table('offers').insert({ offer_id: 'OFR-SEED-1', application_id: 'APP-SEED-3', student_id: 'STU003', drive_id: 'DRV002', status: 'COMMITTED', package_ctc: 750000, joining_date: '2026-07-01', role_title: 'Data Analyst 2026', created_at: day(-3), committed_at: day(-3) });
  await db.table('offers').insert({ offer_id: 'OFR-SEED-2', application_id: 'APP-SEED-6', student_id: 'STU005', drive_id: 'DRV002', status: 'PENDING', created_at: day(-2), committed_at: null });
  await db.table('drives').update('DRV002', { seats: 3 }); // two seats claimed (selected + offer issued)

  const ann = [
    { announcement_id: 'ANN-001', title: 'Campus Placement Registration Open', content: 'Registration for the 2026-27 placement season is open. Complete your profile and upload your resume before applying.', author: 'Prof. Rajesh Kulkarni (TPO)', audience: 'ALL', created_at: day(-12) },
    { announcement_id: 'ANN-002', title: 'Pre-placement talk: TechCorp India', content: 'TechCorp will hold a PPT on campus. Attendance is mandatory for shortlisted candidates.', author: 'Prof. Rajesh Kulkarni (TPO)', audience: 'ALL', created_at: day(-5) },
    { announcement_id: 'ANN-003', title: 'Resume workshop this Friday', content: 'Bring a printed copy of your resume for review by the placement cell.', author: 'Training & Placement Cell', audience: 'ALL', created_at: day(-1) },
  ];
  for (const a of ann) await db.table('announcements').insert(a);

  await notificationService.notify('STU001', { type: 'SHORTLISTED', title: 'You have been shortlisted', message: 'You were shortlisted for SDE Intern 2026. Watch for interview details.', entityId: 'APP-SEED-1' });
  await notificationService.notify('STU003', { type: 'OFFER_ISSUED', title: 'Placement offer issued', message: 'Offer for Data Analyst 2026 — ₹7.5 LPA. Please accept or decline from the Offers page.', entityId: 'APP-SEED-3' });
  await notificationService.notify('STU003', { type: 'INTERVIEW_SCHEDULED', title: 'Interview scheduled', message: 'Technical Interview for SDE Intern 2026 is scheduled.', entityId: 'APP-SEED-2' });
  await notificationService.notifyStaff({ type: 'APPLICATION_SUBMITTED', title: 'New eligible application', message: 'Neha Kulkarni (STU007) applied for Cloud Engineer 2026 — ELIGIBLE.', entityId: 'APP-SEED-7' });

  return { seeded: true, students: STUDENTS.length, drives: DRIVES.length, applications: apps.length };
}

module.exports = { seed, STUDENTS, COMPANIES, DRIVES };
