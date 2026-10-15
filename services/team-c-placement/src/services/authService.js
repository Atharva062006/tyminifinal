/**
 * AuthService — user accounts, password hashing (scrypt) and signed session tokens.
 * Accounts live in Team C's `users` table; students are linked to a `students` row.
 */
const crypto = require('crypto');
const token = require('../../../../shared/token');
const { ValidationError, UnauthorizedError, ConflictError, NotFoundError } = require('../../../../shared/errors');

const ROLES = ['student', 'faculty', 'admin', 'auditor'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

class AuthService {
  constructor(db, auditService) {
    this.db = db;
    this.audit = auditService;
  }

  _publicUser(user, student) {
    const out = {
      id: user.student_id || user.user_id,
      user_id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.username,
      student_id: user.student_id || null,
      active: user.active,
      created_at: user.created_at,
      last_login_at: user.last_login_at || null,
    };
    if (student) {
      Object.assign(out, {
        branch: student.branch, cgpa: student.cgpa, backlogs: student.backlogs,
        attendance: student.attendance, skills: student.skills || [],
      });
    }
    return out;
  }

  _issue(user) {
    const student = user.student_id ? this.db.table('students').findById(user.student_id) : null;
    const pub = this._publicUser(user, student);
    return {
      token: token.sign({ sub: user.user_id, id: pub.id, role: user.role, name: user.name, student_id: user.student_id || null }),
      user: pub,
    };
  }

  _nextStudentId() {
    let max = 0;
    for (const s of this.db.table('students').all()) {
      const m = /^STU(\d+)$/.exec(s.student_id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `STU${String(max + 1).padStart(3, '0')}`;
  }

  validatePassword(pw) {
    if (typeof pw !== 'string' || pw.length < 6) {
      throw new ValidationError('Password must be at least 6 characters', [{ field: 'password', message: 'Minimum 6 characters' }]);
    }
  }

  /** Self-service student registration: creates the student record and the login together. */
  async registerStudent(body, correlationId) {
    const errors = [];
    const email = String(body.email || '').trim().toLowerCase();
    if (!body.name || String(body.name).trim().length < 2) errors.push({ field: 'name', message: 'Full name is required' });
    if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'A valid e-mail is required' });
    if (!body.branch) errors.push({ field: 'branch', message: 'Branch is required' });
    const cgpa = Number(body.cgpa);
    if (!(cgpa >= 0 && cgpa <= 10)) errors.push({ field: 'cgpa', message: 'CGPA must be between 0 and 10' });
    const backlogs = Number(body.backlogs ?? 0);
    if (!(backlogs >= 0)) errors.push({ field: 'backlogs', message: 'Backlogs must be 0 or more' });
    if (errors.length) throw new ValidationError('Registration details are invalid', errors);
    this.validatePassword(body.password);

    if (this.db.table('users').find(u => u.username === email).length) {
      throw new ConflictError('An account with this e-mail already exists');
    }

    const studentId = this._nextStudentId();
    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const student = {
      student_id: studentId,
      name: String(body.name).trim(),
      email,
      branch: body.branch,
      cgpa,
      backlogs,
      attendance: body.attendance != null && body.attendance !== '' ? Number(body.attendance) : 80,
      skills: Array.isArray(body.skills) ? body.skills : [],
      phone: body.phone || undefined,
      year: body.year ? Number(body.year) : undefined,
      academic_verified: false,
      created_at: now,
      updated_at: now,
    };
    const user = {
      user_id: studentId, username: email, password_hash: hash(body.password, salt), salt,
      role: 'student', name: student.name, student_id: studentId, active: true, created_at: now,
    };

    await this.db.transactionIndexed(async (txn) => {
      await txn.lock(`uniq:users:${email}`);
      if (this.db.table('users').find(u => u.username === email).length) throw new ConflictError('An account with this e-mail already exists');
      await txn.insert('students', studentId, student);
      await txn.insert('users', studentId, user);
    });

    if (this.audit) {
      await this.audit.log({ actor: studentId, action: 'REGISTER_STUDENT', tableName: 'users', recordId: studentId, after: { ...this._publicUser(user, student) }, correlationId });
    }
    return { ...this._issue(user), student };
  }

  async login({ username, password }, correlationId) {
    const email = String(username || '').trim().toLowerCase();
    if (!email || !password) throw new ValidationError('E-mail and password are required');
    const user = this.db.table('users').find(u => u.username === email)[0];
    if (!user || hash(String(password), user.salt) !== user.password_hash) {
      throw new UnauthorizedError('Invalid e-mail or password');
    }
    if (!user.active) throw new UnauthorizedError('This account has been deactivated. Contact the placement cell.');
    const updated = await this.db.table('users').update(user.user_id, { last_login_at: new Date().toISOString() });
    if (this.audit) await this.audit.log({ actor: user.user_id, action: 'LOGIN', tableName: 'users', recordId: user.user_id, correlationId });
    return this._issue(updated);
  }

  me(userId) {
    const user = this.db.table('users').findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    const student = user.student_id ? this.db.table('students').findById(user.student_id) : null;
    return this._publicUser(user, student);
  }

  async changePassword(userId, { current_password, new_password }) {
    const user = this.db.table('users').findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    if (hash(String(current_password || ''), user.salt) !== user.password_hash) throw new UnauthorizedError('Current password is incorrect');
    this.validatePassword(new_password);
    const salt = crypto.randomBytes(16).toString('hex');
    await this.db.table('users').update(userId, { salt, password_hash: hash(new_password, salt) });
    return { changed: true };
  }

  // ── Admin user management ────────────────────────────────────────────────

  listUsers() {
    return this.db.table('users').all().map(u => this._publicUser(u, null))
      .sort((a, b) => a.user_id.localeCompare(b.user_id));
  }

  async createStaff({ name, email, password, role }, actor, correlationId) {
    if (!['faculty', 'admin', 'auditor'].includes(role)) throw new ValidationError('Role must be faculty, admin or auditor');
    const username = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(username)) throw new ValidationError('A valid e-mail is required');
    if (!name) throw new ValidationError('Name is required');
    this.validatePassword(password);
    if (this.db.table('users').find(u => u.username === username).length) throw new ConflictError('An account with this e-mail already exists');
    const prefix = { faculty: 'FAC', admin: 'ADM', auditor: 'AUD' }[role];
    const n = this.db.table('users').all().filter(u => u.role === role).length + 1;
    const user_id = `${prefix}${String(n).padStart(3, '0')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const row = { user_id, username, password_hash: hash(password, salt), salt, role, name, active: true, created_at: new Date().toISOString() };
    await this.db.table('users').insert(row);
    if (this.audit) await this.audit.log({ actor, action: 'CREATE_USER', tableName: 'users', recordId: user_id, after: this._publicUser(row, null), correlationId });
    return this._publicUser(row, null);
  }

  async updateUser(userId, body, actor, correlationId) {
    const before = this.db.table('users').findById(userId);
    if (!before) throw new NotFoundError('User', userId);
    const updates = {};
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) throw new ValidationError('Unknown role');
      if (before.role === 'student' || body.role === 'student') throw new ValidationError('Student roles cannot be changed here');
      updates.role = body.role;
    }
    if (body.active !== undefined) {
      if (userId === actor && body.active === false) throw new ConflictError('You cannot deactivate your own account');
      updates.active = Boolean(body.active);
    }
    if (body.name) updates.name = String(body.name);
    if (body.new_password) {
      this.validatePassword(body.new_password);
      updates.salt = crypto.randomBytes(16).toString('hex');
      updates.password_hash = hash(body.new_password, updates.salt);
    }
    const after = await this.db.table('users').update(userId, updates);
    if (this.audit) await this.audit.log({ actor, action: 'UPDATE_USER', tableName: 'users', recordId: userId, before: this._publicUser(before, null), after: this._publicUser(after, null), correlationId });
    return this._publicUser(after, null);
  }

  /** Create login accounts for any student / staff row that does not have one (idempotent). */
  async ensureAccounts() {
    const created = [];
    const mk = async (user_id, username, role, name, password, student_id) => {
      if (this.db.table('users').findById(user_id)) return;
      const salt = crypto.randomBytes(16).toString('hex');
      await this.db.table('users').insert({
        user_id, username, password_hash: hash(password, salt), salt, role, name,
        student_id: student_id || undefined, active: true, created_at: new Date().toISOString(),
      });
      created.push(user_id);
    };
    await mk('FAC001', 'tpo@rit.edu', 'faculty', 'Prof. Rajesh Kulkarni (TPO)', 'faculty123');
    await mk('ADM001', 'admin@rit.edu', 'admin', 'Prof. Suresh Deshmukh', 'admin123');
    await mk('AUD001', 'auditor@rit.edu', 'auditor', 'Meera Iyer (Internal Auditor)', 'auditor123');
    for (const s of this.db.table('students').all()) {
      await mk(s.student_id, String(s.email).toLowerCase(), 'student', s.name, 'student123', s.student_id);
    }
    return created;
  }
}

module.exports = AuthService;
