/**
 * Dashboard Aggregation Service for Team D BFF.
 * Aggregates data across Team C (authoritative), Team A (telemetry/queue), and Team B (rankings).
 */
const teamC = require('./teamCClient');
const teamA = require('./teamAClient');
const teamB = require('./teamBClient');

class DashboardService {
  /**
   * Aggregate dashboard for a Student
   */
  async getStudentDashboard(studentId, correlationId) {
    const [allDrives, allCompanies, studentApps] = await Promise.all([
      teamC.listDrives({}, correlationId).catch(() => []),
      teamC.listCompanies(correlationId).catch(() => []),
      teamC.listApplications({ student_id: studentId }, correlationId).catch(() => [])
    ]);

    const companyMap = new Map(allCompanies.map(c => [c.company_id, c]));
    const driveMap = new Map(allDrives.map(d => [d.drive_id, d]));

    // Enrich applications
    const enrichedApps = studentApps.map(app => {
      const drive = driveMap.get(app.drive_id) || {};
      const company = companyMap.get(drive.company_id) || {};
      return {
        ...app,
        drive_title: drive.title || 'Placement Drive',
        company_name: company.name || 'Company',
        package: drive.package,
        drive_state: drive.state
      };
    });

    const shortlisted = enrichedApps.filter(a => ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED'].includes(a.state)).length;
    const interviews = enrichedApps.filter(a => ['INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED'].includes(a.state)).length;
    const offers = enrichedApps.filter(a => ['SELECTED', 'OFFER_ISSUED'].includes(a.state)).length;
    const activeDrives = allDrives.filter(d => d.state === 'OPEN');

    return {
      student_id: studentId,
      kpis: {
        total_applications: studentApps.length,
        shortlisted_count: shortlisted,
        interviews_count: interviews,
        offers_count: offers,
        available_drives_count: activeDrives.length
      },
      recent_applications: enrichedApps.slice(0, 5),
      open_drives: activeDrives.slice(0, 4).map(d => ({
        ...d,
        company: companyMap.get(d.company_id) || null
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Aggregate operations dashboard for Faculty / TPO
   */
  async getFacultyDashboard(correlationId, authHeader) {
    const [allDrives, allCompanies, allApps, report, aMetrics, bMetrics] = await Promise.all([
      teamC.listDrives({}, correlationId).catch(() => []),
      teamC.listCompanies(correlationId).catch(() => []),
      teamC.listApplications({}, correlationId).catch(() => []),
      teamC.getPlacementPerformance({}, correlationId, authHeader).catch(() => null),
      teamA.getMetrics(correlationId).catch(() => ({ metrics: {} })),
      teamB.getMetrics(correlationId).catch(() => ({ metrics: {} }))
    ]);

    const companyMap = new Map(allCompanies.map(c => [c.company_id, c]));

    const stateCounts = {
      APPLIED: 0,
      SCREENING: 0,
      RULE_EVALUATED: 0,
      SHORTLISTED: 0,
      INTERVIEW_SCHEDULED: 0,
      SELECTED: 0,
      OFFER_ISSUED: 0,
      NOT_ELIGIBLE: 0,
      WAITLISTED: 0,
      WITHDRAWN: 0
    };

    allApps.forEach(a => {
      if (stateCounts[a.state] !== undefined) {
        stateCounts[a.state]++;
      }
    });

    const drivesSummary = allDrives.map(d => {
      const driveApps = allApps.filter(a => a.drive_id === d.drive_id);
      const selected = driveApps.filter(a => ['SELECTED', 'OFFER_ISSUED'].includes(a.state)).length;
      return {
        drive_id: d.drive_id,
        title: d.title,
        company_name: companyMap.get(d.company_id)?.name || 'Company',
        total_seats: (d.seats || 0) + selected,
        remaining_seats: d.seats || 0,
        applications_count: driveApps.length,
        selected_count: selected,
        state: d.state,
        package: d.package
      };
    });

    return {
      kpis: {
        total_applications: allApps.length,
        eligible_or_evaluated: (stateCounts.RULE_EVALUATED || 0) + (stateCounts.SHORTLISTED || 0),
        shortlisted: stateCounts.SHORTLISTED || 0,
        interviews_scheduled: stateCounts.INTERVIEW_SCHEDULED || 0,
        selected_count: stateCounts.SELECTED || 0,
        offers_issued: stateCounts.OFFER_ISSUED || 0,
        not_eligible: stateCounts.NOT_ELIGIBLE || 0,
        waitlisted: stateCounts.WAITLISTED || 0
      },
      pipeline_distribution: stateCounts,
      drives_summary: drivesSummary,
      performance_report: report,
      telemetry: {
        team_a: aMetrics.metrics || {},
        team_b: bMetrics.metrics || {}
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Aggregate dashboard for Placement Admin
   */
  async getAdminDashboard(correlationId, authHeader) {
    const [facultyData, auditRecords, aHealth, bHealth, cHealth] = await Promise.all([
      this.getFacultyDashboard(correlationId, authHeader),
      teamC.queryAudit({ limit: 10 }, correlationId, authHeader).catch(() => ({ records: [] })),
      teamA.checkHealth(),
      teamB.checkHealth(),
      teamC.checkHealth()
    ]);

    const auditList = Array.isArray(auditRecords)
      ? auditRecords
      : (auditRecords?.entries || auditRecords?.records || []);

    return {
      ...facultyData,
      system_health: {
        team_a: aHealth,
        team_b: bHealth,
        team_c: cHealth,
        team_d: { status: 'ONLINE', port: 3000 }
      },
      recent_audit_events: auditList,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new DashboardService();
