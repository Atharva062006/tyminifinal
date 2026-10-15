/**
 * Dashboard Aggregation Service for Team D BFF.
 * Aggregates data across Team C (authoritative), Team A (telemetry/queue), and Team B (rankings).
 */
const teamC = require('./teamCClient');
const teamA = require('./teamAClient');
const teamB = require('./teamBClient');

const PIPELINE_STATES = ['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED',
  'OFFER_ACCEPTED', 'OFFER_DECLINED', 'NOT_ELIGIBLE', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'];

class DashboardService {
  /** Aggregate dashboard for a Student */
  async getStudentDashboard(studentId, correlationId, actor) {
    const [allDrives, allCompanies, studentApps, student, interviews, offers, announcements, notifications] = await Promise.all([
      teamC.listDrives({}, correlationId).catch(() => []),
      teamC.listCompanies(correlationId).catch(() => []),
      teamC.listApplications({ student_id: studentId }, correlationId, actor).catch(() => []),
      teamC.getStudent(studentId, correlationId).catch(() => null),
      teamC.listInterviews({ student_id: studentId }, correlationId, actor).catch(() => []),
      teamC.listOffers({ student_id: studentId }, correlationId, actor).catch(() => []),
      teamC.listAnnouncements(correlationId).catch(() => []),
      actor ? teamC.listNotifications({ unread: 'true' }, correlationId, actor).catch(() => null) : Promise.resolve(null),
    ]);

    const companyMap = new Map(allCompanies.map(c => [c.company_id, c]));
    const driveMap = new Map(allDrives.map(d => [d.drive_id, d]));

    const enrichedApps = studentApps.map(app => {
      const drive = driveMap.get(app.drive_id) || {};
      const company = companyMap.get(drive.company_id) || {};
      return { ...app, drive_title: drive.title || 'Placement Drive', company_name: company.name || 'Company', package: drive.package, drive_state: drive.state };
    }).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

    const past = (states) => enrichedApps.filter(a => states.includes(a.state)).length;
    const appliedDriveIds = new Set(studentApps.filter(a => !['WITHDRAWN', 'REJECTED', 'NOT_ELIGIBLE'].includes(a.state)).map(a => a.drive_id));
    const activeDrives = allDrives.filter(d => d.state === 'OPEN');
    const upcoming = interviews.filter(i => i.status === 'SCHEDULED' && new Date(i.scheduled_at) > new Date(Date.now() - 3600000));
    const pendingOffers = offers.filter(o => o.status === 'COMMITTED');

    // Next-step guidance
    const todo = [];
    if (student && !student.resume_url) todo.push({ key: 'resume', text: 'Add your resume link to your profile', href: '#/student/profile' });
    if (student && (student.skills || []).length < 3) todo.push({ key: 'skills', text: 'Add at least 3 skills so rankings can match you to drives', href: '#/student/profile' });
    if (pendingOffers.length) todo.push({ key: 'offer', text: `You have ${pendingOffers.length} offer(s) awaiting your decision`, href: '#/student/offers' });
    if (upcoming.length) todo.push({ key: 'interview', text: `${upcoming.length} upcoming interview(s)`, href: '#/student/interviews' });
    const openToApply = activeDrives.filter(d => !appliedDriveIds.has(d.drive_id));
    if (openToApply.length) todo.push({ key: 'drives', text: `${openToApply.length} open drive(s) you have not applied to`, href: '#/student/drives' });

    return {
      student_id: studentId,
      student: student ? { name: student.name, branch: student.branch, cgpa: student.cgpa, academic_verified: student.academic_verified } : null,
      kpis: {
        total_applications: studentApps.length,
        shortlisted_count: past(['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED']),
        interviews_count: upcoming.length,
        offers_count: offers.filter(o => ['COMMITTED', 'ACCEPTED'].includes(o.status)).length,
        available_drives_count: activeDrives.length,
        unread_notifications: notifications ? notifications.unread_count : 0,
      },
      recent_applications: enrichedApps.slice(0, 5),
      upcoming_interviews: upcoming.slice(0, 3).map(i => ({ ...i, drive_title: driveMap.get(i.drive_id)?.title, company_name: companyMap.get(driveMap.get(i.drive_id)?.company_id)?.name })),
      pending_offers: pendingOffers.map(o => ({ ...o, drive_title: driveMap.get(o.drive_id)?.title, company_name: companyMap.get(driveMap.get(o.drive_id)?.company_id)?.name })),
      open_drives: activeDrives.slice(0, 4).map(d => ({ ...d, company: companyMap.get(d.company_id) || null, applied: appliedDriveIds.has(d.drive_id) })),
      announcements: announcements.slice(0, 3),
      todo,
      timestamp: new Date().toISOString(),
    };
  }

  /** Aggregate operations dashboard for Faculty / TPO */
  async getFacultyDashboard(correlationId, actor) {
    const [allDrives, allCompanies, allApps, allStudents, report, aMetrics, bMetrics, interviews, announcements] = await Promise.all([
      teamC.listDrives({}, correlationId).catch(() => []),
      teamC.listCompanies(correlationId).catch(() => []),
      teamC.listApplications({}, correlationId, actor).catch(() => []),
      teamC.listStudents(correlationId).catch(() => []),
      teamC.getPlacementPerformance({}, correlationId, actor).catch(() => null),
      teamA.getMetrics(correlationId).catch(() => ({ metrics: {} })),
      teamB.getMetrics(correlationId).catch(() => ({ metrics: {} })),
      teamC.listInterviews({ status: 'SCHEDULED' }, correlationId, actor).catch(() => []),
      teamC.listAnnouncements(correlationId).catch(() => []),
    ]);

    const companyMap = new Map(allCompanies.map(c => [c.company_id, c]));
    const driveMap = new Map(allDrives.map(d => [d.drive_id, d]));
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));

    const stateCounts = Object.fromEntries(PIPELINE_STATES.map(s => [s, 0]));
    allApps.forEach(a => { if (stateCounts[a.state] !== undefined) stateCounts[a.state]++; });

    const drivesSummary = allDrives.map(d => {
      const driveApps = allApps.filter(a => a.drive_id === d.drive_id);
      const selected = driveApps.filter(a => ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'].includes(a.state)).length;
      return {
        drive_id: d.drive_id,
        title: d.title,
        company_name: companyMap.get(d.company_id)?.name || 'Company',
        total_seats: d.seats_total || (d.seats || 0) + selected,
        remaining_seats: d.seats || 0,
        applications_count: driveApps.length,
        selected_count: selected,
        pending_review: driveApps.filter(a => a.state === 'RULE_EVALUATED').length,
        state: d.state,
        package: d.package,
      };
    });

    const pendingReview = allApps.filter(a => a.state === 'RULE_EVALUATED')
      .sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 8)
      .map(a => ({ ...a, student_name: studentMap.get(a.student_id)?.name, drive_title: driveMap.get(a.drive_id)?.title }));

    return {
      kpis: {
        total_applications: allApps.length,
        eligible_or_evaluated: stateCounts.RULE_EVALUATED + stateCounts.SHORTLISTED,
        pending_review: stateCounts.RULE_EVALUATED,
        shortlisted: stateCounts.SHORTLISTED,
        interviews_scheduled: stateCounts.INTERVIEW_SCHEDULED,
        selected_count: stateCounts.SELECTED,
        offers_issued: stateCounts.OFFER_ISSUED,
        offers_accepted: stateCounts.OFFER_ACCEPTED,
        not_eligible: stateCounts.NOT_ELIGIBLE,
        waitlisted: stateCounts.WAITLISTED,
        rejected: stateCounts.REJECTED,
        stalled_pipeline: allApps.filter(a => a.pipeline_status === 'EVALUATION_PENDING').length,
      },
      pipeline_distribution: stateCounts,
      drives_summary: drivesSummary,
      pending_review: pendingReview,
      upcoming_interviews: interviews.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).slice(0, 6)
        .map(i => ({ ...i, student_name: studentMap.get(i.student_id)?.name, drive_title: driveMap.get(i.drive_id)?.title })),
      announcements: announcements.slice(0, 3),
      performance_report: report,
      telemetry: { team_a: aMetrics.metrics || {}, team_b: bMetrics.metrics || {} },
      timestamp: new Date().toISOString(),
    };
  }

  /** Aggregate dashboard for Placement Admin */
  async getAdminDashboard(correlationId, actor) {
    const [facultyData, auditRecords, aHealth, bHealth, cHealth, reconciliation, users] = await Promise.all([
      this.getFacultyDashboard(correlationId, actor),
      teamC.queryAudit({ limit: 10 }, correlationId, actor).catch(() => ({ entries: [] })),
      teamA.checkHealth(),
      teamB.checkHealth(),
      teamC.checkHealth(),
      teamC.reconciliation(correlationId, actor).catch(() => null),
      teamC.listUsers(actor, correlationId).catch(() => []),
    ]);

    const auditList = Array.isArray(auditRecords) ? auditRecords : (auditRecords?.entries || auditRecords?.records || []);
    return {
      ...facultyData,
      system_health: { team_a: aHealth, team_b: bHealth, team_c: cHealth, team_d: { status: 'ONLINE', port: 3000 } },
      reconciliation,
      user_summary: {
        total: users.length,
        by_role: users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {}),
        inactive: users.filter(u => u.active === false).length,
      },
      recent_audit_events: auditList,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new DashboardService();
