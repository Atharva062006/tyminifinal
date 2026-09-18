/**
 * Seed deterministic test data into Team C's DB.
 * Run: node scripts/seed-data.js
 */
const path = require('path');

// Load Team C's DB directly for seeding
const Database = require(path.resolve(__dirname, '../services/team-c-placement/src/db/Database'));

async function seed() {
  const db = new Database();
  await db.initialize();

  console.log('Seeding students...');
  const students = [
    { student_id: 'STU001', name: 'Aarav Sharma',  email: 'aarav@rit.edu',  branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, skills: ['JavaScript', 'Python', 'SQL'] },
    { student_id: 'STU002', name: 'Rohan Patil',    email: 'rohan@rit.edu',  branch: 'CSE', cgpa: 7.4, backlogs: 1, attendance: 75, skills: ['Java', 'Spring', 'MySQL'] },
    { student_id: 'STU003', name: 'Ananya Mehta',  email: 'ananya@rit.edu', branch: 'IT',  cgpa: 9.1, backlogs: 0, attendance: 92, skills: ['React', 'Node.js', 'MongoDB'] },
    { student_id: 'STU004', name: 'Devraj Kumar',  email: 'devraj@rit.edu', branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 70, skills: ['C++', 'DSA'] },
    { student_id: 'STU005', name: 'Isha Joshi',    email: 'isha@rit.edu',   branch: 'ENTC', cgpa: 8.2, backlogs: 0, attendance: 85, skills: ['Python', 'ML', 'TensorFlow'] },
  ];
  for (const s of students) {
    await db.table('students').insert(s).catch(() => {});
  }

  console.log('Seeding companies...');
  const companies = [
    { company_id: 'COM001', name: 'TechCorp India', industry: 'IT Services', website: 'https://techcorp.in' },
    { company_id: 'COM002', name: 'DataSoft',       industry: 'Analytics',   website: 'https://datasoft.io' },
  ];
  for (const c of companies) {
    await db.table('companies').insert(c).catch(() => {});
  }

  console.log('Seeding drives...');
  const drives = [
    {
      drive_id: 'DRV001', company_id: 'COM001', title: 'SDE Intern 2026',
      criteria_json: JSON.stringify({ min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript', 'Python'] }),
      seats: 10, package: 600000, state: 'OPEN', version: 1,
    },
    {
      drive_id: 'DRV002', company_id: 'COM002', title: 'Data Analyst 2026',
      criteria_json: JSON.stringify({ min_cgpa: 8.0, max_backlogs: 0, branches: ['CSE', 'IT', 'ENTC'], min_attendance: 80, required_skills: ['Python', 'SQL'] }),
      seats: 5, package: 750000, state: 'OPEN', version: 1,
    },
  ];
  for (const d of drives) {
    await db.table('drives').insert(d).catch(() => {});
  }

  console.log('✅ Seed data loaded successfully.');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
