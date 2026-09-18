/**
 * Mock Adapter for Team C — DBMS Engine (Port 3003).
 * Used only when MOCK_TEAM_C=true or in isolated mock unit tests.
 */
const { v4: uuidv4 } = require('uuid');

class MockTeamC {
  constructor() {
    this.students = [
      { student_id: 'STU001', name: 'Aarav Sharma', email: 'aarav@rit.edu', branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, skills: ['JavaScript', 'Python', 'SQL'] },
      { student_id: 'STU002', name: 'Rohan Patil', email: 'rohan@rit.edu', branch: 'CSE', cgpa: 7.4, backlogs: 1, attendance: 75, skills: ['Java', 'Spring', 'MySQL'] },
      { student_id: 'STU003', name: 'Ananya Mehta', email: 'ananya@rit.edu', branch: 'IT', cgpa: 9.1, backlogs: 0, attendance: 92, skills: ['React', 'Node.js', 'MongoDB'] },
      { student_id: 'STU004', name: 'Devraj Kumar', email: 'devraj@rit.edu', branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 70, skills: ['C++', 'DSA'] },
      { student_id: 'STU005', name: 'Isha Joshi', email: 'isha@rit.edu', branch: 'ENTC', cgpa: 8.2, backlogs: 0, attendance: 85, skills: ['Python', 'ML', 'TensorFlow'] }
    ];

    this.companies = [
      { company_id: 'COM001', name: 'TechCorp India', industry: 'IT Services', website: 'https://techcorp.in' },
      { company_id: 'COM002', name: 'DataSoft', industry: 'Analytics', website: 'https://datasoft.io' }
    ];

    this.drives = [
      {
        drive_id: 'DRV001', company_id: 'COM001', title: 'SDE Intern 2026',
        criteria_json: JSON.stringify({ min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript', 'Python'] }),
        seats: 10, package: 600000, state: 'OPEN', version: 1
      },
      {
        drive_id: 'DRV002', company_id: 'COM002', title: 'Data Analyst 2026',
        criteria_json: JSON.stringify({ min_cgpa: 8.0, max_backlogs: 0, branches: ['CSE', 'IT', 'ENTC'], min_attendance: 80, required_skills: ['Python', 'SQL'] }),
        seats: 5, package: 750000, state: 'OPEN', version: 1
      }
    ];

    this.applications = new Map([
      ['APP-001', { application_id: 'APP-001', student_id: 'STU001', drive_id: 'DRV001', state: 'APPLIED', version: 1, consent: true, created_at: new Date().toISOString() }],
      ['APP-002', { application_id: 'APP-002', student_id: 'STU002', drive_id: 'DRV001', state: 'APPLIED', version: 1, consent: true, created_at: new Date().toISOString() }]
    ]);
    this.auditLog = [];
  }

  async listCompanies() { return this.companies; }
  async getCompany(id) { return this.companies.find(c => c.company_id === id); }

  async listStudents() { return this.students; }
  async getStudent(id) { return this.students.find(s => s.student_id === id); }
  async updateStudent(id, updates) {
    const student = this.students.find(s => s.student_id === id);
    if (student) {
      Object.assign(student, updates);
      return student;
    }
    throw new Error(`Student ${id} not found`);
  }

  async listDrives(state) {
    if (state) return this.drives.filter(d => d.state === state);
    return this.drives;
  }
  async getDrive(id) { return this.drives.find(d => d.drive_id === id); }

  async createApplication(data) {
    if (data.idempotency_key) {
      for (const app of this.applications.values()) {
        if (app.idempotency_key === data.idempotency_key) {
          return app;
        }
      }
    }
    const appId = `APP-${uuidv4().substring(0, 8)}`;
    const record = {
      application_id: appId,
      student_id: data.student_id,
      drive_id: data.drive_id,
      state: 'APPLIED',
      version: 1,
      consent: data.consent,
      idempotency_key: data.idempotency_key,
      created_at: new Date().toISOString()
    };
    this.applications.set(appId, record);
    return record;
  }

  async listApplications(filter = {}) {
    let list = Array.from(this.applications.values());
    if (filter.student_id) list = list.filter(a => a.student_id === filter.student_id);
    if (filter.drive_id) list = list.filter(a => a.drive_id === filter.drive_id);
    if (filter.state) list = list.filter(a => a.state === filter.state);
    return list;
  }

  async getApplication(id) {
    return this.applications.get(id);
  }

  async withdrawApplication(id) {
    const app = this.applications.get(id);
    if (app) {
      app.state = 'WITHDRAWN';
      app.updated_at = new Date().toISOString();
    }
    return app;
  }
}

module.exports = new MockTeamC();
