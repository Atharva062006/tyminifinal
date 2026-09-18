/**
 * Analytics & Reporting Aggregation Service for Team D BFF.
 * Derives comprehensive data-driven analytics from Team C (DBMS), Team B (Ranking), and Team A (Eligibility).
 */
const teamC = require('./teamCClient');
const teamA = require('./teamAClient');
const teamB = require('./teamBClient');

class AnalyticsService {
  /**
   * Calculate comprehensive placement analytics
   */
  async getComprehensiveAnalytics(filters = {}, correlationId, authHeader) {
    const { range = 'academic_year', branch = 'ALL', company_id } = filters;

    // Fetch data in parallel from authoritative sources
    const [allStudents, allDrives, allCompanies, allApplications, aMetrics, bMetrics] = await Promise.all([
      teamC.listStudents(correlationId).catch(() => []),
      teamC.listDrives({}, correlationId).catch(() => []),
      teamC.listCompanies(correlationId).catch(() => []),
      teamC.listApplications({}, correlationId).catch(() => []),
      teamA.getMetrics(correlationId).catch(() => ({ metrics: {} })),
      teamB.getMetrics(correlationId).catch(() => ({ metrics: {} }))
    ]);

    // Apply branch filter if specified
    const filteredStudents = branch === 'ALL' ? allStudents : allStudents.filter(s => s.branch === branch);
    const studentIdSet = new Set(filteredStudents.map(s => s.student_id));
    
    const filteredApps = branch === 'ALL' 
      ? allApplications 
      : allApplications.filter(a => studentIdSet.has(a.student_id));

    // Pipeline counts
    const pipeline = {
      APPLIED: 0,
      SCREENING: 0,
      RULE_EVALUATED: 0,
      SHORTLISTED: 0,
      INTERVIEW_SCHEDULED: 0,
      SELECTED: 0,
      OFFER_ISSUED: 0,
      OFFER_ACCEPTED: 0,
      OFFER_DECLINED: 0,
      WITHDRAWN: 0,
      NOT_ELIGIBLE: 0,
      WAITLISTED: 0
    };

    filteredApps.forEach(app => {
      if (pipeline[app.state] !== undefined) {
        pipeline[app.state]++;
      }
    });

    // KPI Calculations
    const totalStudents = filteredStudents.length || 1;
    const eligibleStudents = filteredStudents.filter(s => (s.cgpa || 0) >= 6.0 && (s.backlogs || 0) === 0).length;
    const totalDrives = allDrives.length;
    const activeDrives = allDrives.filter(d => d.state === 'OPEN').length;
    const totalApplications = filteredApps.length;
    const shortlistedCount = pipeline.SHORTLISTED + pipeline.INTERVIEW_SCHEDULED + pipeline.SELECTED + pipeline.OFFER_ISSUED + pipeline.OFFER_ACCEPTED;
    const interviewsScheduled = pipeline.INTERVIEW_SCHEDULED + pipeline.SELECTED + pipeline.OFFER_ISSUED + pipeline.OFFER_ACCEPTED;
    const offersIssued = pipeline.OFFER_ISSUED + pipeline.OFFER_ACCEPTED;
    const offersAccepted = pipeline.OFFER_ACCEPTED;
    const offersDeclined = pipeline.OFFER_DECLINED;

    const placementRatePct = parseFloat(((offersAccepted / totalStudents) * 100).toFixed(1));
    const offerConversionPct = totalApplications > 0 ? parseFloat(((offersIssued / totalApplications) * 100).toFixed(1)) : 0;

    // Package Analytics (where offer values exist)
    const driveMap = new Map(allDrives.map(d => [d.drive_id, d]));
    const packages = filteredApps
      .filter(a => ['OFFER_ISSUED', 'OFFER_ACCEPTED', 'SELECTED'].includes(a.state))
      .map(a => driveMap.get(a.drive_id)?.package || 600000)
      .sort((a, b) => a - b);

    let packageStats = {
      highest: 'Insufficient Data',
      lowest: 'Insufficient Data',
      average: 'Insufficient Data',
      median: 'Insufficient Data',
      distribution: []
    };

    if (packages.length > 0) {
      const highest = Math.max(...packages);
      const lowest = Math.min(...packages);
      const sum = packages.reduce((acc, p) => acc + p, 0);
      const avg = sum / packages.length;
      const midIndex = Math.floor(packages.length / 2);
      const median = packages.length % 2 !== 0 ? packages[midIndex] : (packages[midIndex - 1] + packages[midIndex]) / 2;

      packageStats = {
        highest,
        lowest,
        average: Math.round(avg),
        median,
        distribution: [
          { tier: '< ₹5 LPA', count: packages.filter(p => p < 500000).length },
          { tier: '₹5 LPA - ₹8 LPA', count: packages.filter(p => p >= 500000 && p <= 800000).length },
          { tier: '₹8 LPA - ₹12 LPA', count: packages.filter(p => p > 800000 && p <= 1200000).length },
          { tier: '> ₹12 LPA', count: packages.filter(p => p > 1200000).length }
        ]
      };
    }

    // Branch Breakdown
    const branches = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL'];
    const branchBreakdown = branches.map(b => {
      const bStudents = allStudents.filter(s => s.branch === b);
      const bStudentIds = new Set(bStudents.map(s => s.student_id));
      const bApps = allApplications.filter(a => bStudentIds.has(a.student_id));
      const bOffers = bApps.filter(a => ['OFFER_ISSUED', 'OFFER_ACCEPTED', 'SELECTED'].includes(a.state)).length;
      const bPlaced = bApps.filter(a => a.state === 'OFFER_ACCEPTED').length;

      return {
        branch: b,
        total_students: bStudents.length,
        eligible_students: bStudents.filter(s => (s.cgpa || 0) >= 6.0 && (s.backlogs || 0) === 0).length,
        applications: bApps.length,
        offers: bOffers,
        placed: bPlaced,
        placement_pct: bStudents.length > 0 ? parseFloat(((bPlaced / bStudents.length) * 100).toFixed(1)) : 0
      };
    });

    // Drive Analytics Breakdown
    const companyMap = new Map(allCompanies.map(c => [c.company_id, c]));
    const driveAnalytics = allDrives.map(d => {
      const dApps = allApplications.filter(a => a.drive_id === d.drive_id);
      const dOffers = dApps.filter(a => ['OFFER_ISSUED', 'OFFER_ACCEPTED', 'SELECTED'].includes(a.state)).length;
      const dAccepted = dApps.filter(a => a.state === 'OFFER_ACCEPTED').length;

      return {
        drive_id: d.drive_id,
        company_name: companyMap.get(d.company_id)?.name || 'Company',
        role: d.title || 'Role',
        package: d.package || 600000,
        applications: dApps.length,
        offers_issued: dOffers,
        offers_accepted: dAccepted,
        conversion_rate_pct: dApps.length > 0 ? parseFloat(((dOffers / dApps.length) * 100).toFixed(1)) : 0
      };
    });

    return {
      time_range: range,
      branch_filter: branch,
      kpis: {
        total_students: allStudents.length,
        eligible_students: eligibleStudents,
        total_drives: totalDrives,
        active_drives: activeDrives,
        total_applications: totalApplications,
        shortlisted_candidates: shortlistedCount,
        interviews_scheduled: interviewsScheduled,
        offers_issued: offersIssued,
        offers_accepted: offersAccepted,
        offers_declined: offersDeclined,
        placement_rate_pct: placementRatePct,
        offer_conversion_pct: offerConversionPct
      },
      pipeline,
      packages: packageStats,
      branch_breakdown: branchBreakdown,
      drive_analytics: driveAnalytics,
      authorities: {
        eligibility: { service: 'Team A', metrics: aMetrics.metrics || {} },
        ranking: { service: 'Team B', metrics: bMetrics.metrics || {} },
        placement_db: { service: 'Team C', total_records: allApplications.length }
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AnalyticsService();
