/**
 * Mock Adapter for Team A — OS Eligibility Engine (Port 3001).
 * Used when MOCK_TEAM_A=true or when Team A is offline during development/evaluation.
 * Implements deterministic decision evaluation matching Team A's rule logic.
 */
const { v4: uuidv4 } = require('uuid');

class MockTeamA {
  constructor() {
    this.requests = new Map();
    this.metrics = {
      queue_depth: 2,
      throughput_per_sec: 142,
      p95_decision_latency_ms: 18,
      active_leases: 4,
      deadlocks_detected: 0
    };
  }

  /**
   * Evaluate student eligibility against drive criteria
   */
  evaluateRules(student, criteria, strategy = 'DECISION_TREE') {
    const failedRules = [];
    const minCgpa = criteria.min_cgpa ?? 7.0;
    const maxBacklogs = criteria.max_backlogs ?? 1;
    const allowedBranches = criteria.branches || criteria.allowed_branches || ['CSE', 'IT', 'ENTC'];
    const minAttendance = criteria.min_attendance ?? 75;
    const requiredSkills = criteria.required_skills || [];

    if (student.cgpa < minCgpa) {
      failedRules.push(`CGPA ${student.cgpa} < Cutoff ${minCgpa}`);
    }
    if (student.backlogs > maxBacklogs) {
      failedRules.push(`Backlogs ${student.backlogs} > Allowed limit ${maxBacklogs}`);
    }
    if (allowedBranches.length > 0 && !allowedBranches.includes(student.branch)) {
      failedRules.push(`Branch '${student.branch}' not in allowed list [${allowedBranches.join(', ')}]`);
    }
    if (student.attendance && student.attendance < minAttendance) {
      failedRules.push(`Attendance ${student.attendance}% < Required ${minAttendance}%`);
    }

    // Check skills
    if (requiredSkills.length > 0) {
      const studentSkills = student.skills || [];
      const matched = requiredSkills.filter(s => studentSkills.includes(s));
      if (matched.length === 0 && requiredSkills.length > 0) {
        failedRules.push(`Missing required skills: ${requiredSkills.join(', ')}`);
      }
    }

    let result = 'ELIGIBLE';
    if (failedRules.length > 0) {
      // If only backlogs or attendance slightly fails, can be conditional in weighted mode
      if (failedRules.length === 1 && (student.cgpa >= minCgpa)) {
        result = 'CONDITIONAL';
      } else {
        result = 'NOT_ELIGIBLE';
      }
    }

    return {
      decision_id: `DEC-${uuidv4().substring(0, 8)}`,
      eligibility_result: result,
      failed_rules: failedRules,
      passed_rules: [
        student.cgpa >= minCgpa ? `CGPA >= ${minCgpa}` : null,
        student.backlogs <= maxBacklogs ? `Backlogs <= ${maxBacklogs}` : null,
        allowedBranches.includes(student.branch) ? `Branch matches allowlist` : null,
        (student.attendance || 80) >= minAttendance ? `Attendance >= ${minAttendance}%` : null
      ].filter(Boolean),
      rule_set_version: '1.2.0',
      strategy: strategy,
      decision_metrics: {
        evaluation_time_us: Math.floor(Math.random() * 800) + 200,
        rules_evaluated: 5,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create eligibility check request
   */
  async createRequest(data, correlationId) {
    const requestId = data.request_id || `REQ-${uuidv4().substring(0, 8)}`;
    const student = data.student || { student_id: data.student_id, cgpa: 8.5, backlogs: 0, branch: 'CSE' };
    const criteria = data.criteria || { min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'] };

    const decision = this.evaluateRules(student, criteria);
    const record = {
      request_id: requestId,
      application_id: data.application_id,
      student_id: data.student_id,
      drive_id: data.drive_id,
      state: 'READY',
      queue_position: 1,
      estimated_evaluation_time_ms: 25,
      decision: decision,
      rule_set_version: '1.2.0',
      submitted_at: new Date().toISOString(),
      correlation_id: correlationId
    };

    this.requests.set(requestId, record);
    return record;
  }

  /**
   * Get request status
   */
  async getRequest(requestId) {
    if (this.requests.has(requestId)) {
      return this.requests.get(requestId);
    }
    return {
      request_id: requestId,
      state: 'READY',
      queue_position: 0,
      decision: {
        decision_id: `DEC-${requestId.replace('REQ-', '')}`,
        eligibility_result: 'ELIGIBLE',
        failed_rules: [],
        rule_set_version: '1.2.0'
      }
    };
  }

  /**
   * Get queue for a drive
   */
  async getDriveQueue(driveId) {
    return {
      drive_id: driveId,
      queue_policy: 'PRIORITY_QUEUE',
      queue_depth: 3,
      estimated_turnaround_time_ms: 120,
      queued_requests: [
        { request_id: 'REQ-001', student_id: 'STU001', priority: 1, state: 'QUEUED', wait_time_ms: 45 },
        { request_id: 'REQ-002', student_id: 'STU003', priority: 2, state: 'QUEUED', wait_time_ms: 25 },
        { request_id: 'REQ-003', student_id: 'STU005', priority: 3, state: 'READY', wait_time_ms: 10 }
      ]
    };
  }

  /**
   * Get metrics
   */
  async getMetrics() {
    return {
      service: 'team-a-eligibility',
      timestamp: new Date().toISOString(),
      metrics: this.metrics
    };
  }
}

module.exports = new MockTeamA();
