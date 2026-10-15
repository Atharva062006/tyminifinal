/**
 * ReportService — placement performance and cohort analytics (C4).
 * Uses index-backed lookups (hash on student/drive, B-tree range on created_at) for the filtered queries.
 */

const PLACED = ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'];
const SHORTLISTED_PLUS = ['SHORTLISTED', 'INTERVIEW_SCHEDULED', ...PLACED, 'OFFER_DECLINED'];

const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '0%');

class ReportService {
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {object} filters
   * @param {string} [filters.branch]
   * @param {string} [filters.drive_id]
   * @param {string} [filters.from]  ISO date — uses the B-tree index on applications.created_at
   * @param {string} [filters.to]
   */
  async generatePlacementPerformanceReport(filters = {}) {
    const t0 = Date.now();
    const { branch: branchFilter, drive_id: driveIdFilter, from, to } = filters;

    const allDrives = this.db.table('drives').all();
    const allStudents = this.db.table('students').all();
    const studentBranch = new Map(allStudents.map(s => [s.student_id, s.branch]));

    let apps;
    if (driveIdFilter) apps = this.db.lookupBy('applications', 'drive_id', driveIdFilter);
    else if (from || to) {
      apps = [...this.db.index('applications_created_at_btree').rangeQuery(from || null, to || null)]
        .map(pk => this.db.table('applications').findById(pk)).filter(Boolean);
    } else apps = this.db.table('applications').all();
    if (from || to) apps = apps.filter(a => (!from || a.created_at >= from) && (!to || a.created_at <= to));
    if (branchFilter) apps = apps.filter(a => studentBranch.get(a.student_id) === branchFilter);

    const allOffers = this.db.table('offers').all();
    const drives = driveIdFilter ? allDrives.filter(d => d.drive_id === driveIdFilter) : allDrives;
    const driveIds = new Set(drives.map(d => d.drive_id));
    const offers = allOffers.filter(o => driveIds.has(o.drive_id) && apps.some(a => a.application_id === o.application_id));

    const placedApps = apps.filter(a => PLACED.includes(a.state));

    const driveStats = drives.map(d => {
      const dApps = apps.filter(a => a.drive_id === d.drive_id);
      const dPlaced = dApps.filter(a => PLACED.includes(a.state));
      const dOffers = offers.filter(o => o.drive_id === d.drive_id);
      return {
        drive_id: d.drive_id,
        title: d.title,
        company_id: d.company_id,
        state: d.state,
        seats_total: d.seats_total || d.seats + dPlaced.length,
        seats_remaining: d.seats,
        applications: dApps.length,
        shortlisted: dApps.filter(a => SHORTLISTED_PLUS.includes(a.state)).length,
        selected: dPlaced.length,
        offers_issued: dOffers.filter(o => ['COMMITTED', 'ACCEPTED', 'DECLINED'].includes(o.status)).length,
        offers_accepted: dOffers.filter(o => o.status === 'ACCEPTED').length,
        package_lpa: d.package || null,
        conversion_rate: pct(dPlaced.length, dApps.length),
      };
    });

    const branches = [...new Set(allStudents.map(s => s.branch))].filter(Boolean);
    const branchStats = branches.map(b => {
      const ids = new Set(allStudents.filter(s => s.branch === b).map(s => s.student_id));
      const bApps = apps.filter(a => ids.has(a.student_id));
      const bPlaced = bApps.filter(a => PLACED.includes(a.state));
      const placedStudents = new Set(bPlaced.map(a => a.student_id));
      return {
        branch: b,
        total_students: ids.size,
        applications: bApps.length,
        selected: bPlaced.length,
        placed_students: placedStudents.size,
        placement_rate: pct(placedStudents.size, ids.size),
        conversion_rate: pct(bPlaced.length, bApps.length),
      };
    });

    // Package distribution over offers that were actually issued (falls back to drive packages of selected apps)
    const issued = offers.filter(o => ['COMMITTED', 'ACCEPTED'].includes(o.status) && o.package_ctc).map(o => o.package_ctc);
    const packages = issued.length ? issued : placedApps.map(a => (allDrives.find(d => d.drive_id === a.drive_id) || {}).package).filter(Boolean);
    const packageDistribution = packages.length ? {
      min_lpa: Math.min(...packages),
      max_lpa: Math.max(...packages),
      avg_lpa: Math.round(packages.reduce((s, v) => s + v, 0) / packages.length),
      count: packages.length,
    } : null;

    return {
      generated_at: new Date().toISOString(),
      query_time_ms: Date.now() - t0,
      filters_applied: { branch: branchFilter || null, drive_id: driveIdFilter || null, from: from || null, to: to || null },
      totals: {
        total_students: allStudents.length,
        total_applications: apps.length,
        total_selected: placedApps.length,
        total_offers_issued: offers.filter(o => ['COMMITTED', 'ACCEPTED', 'DECLINED'].includes(o.status)).length,
        total_offers_accepted: offers.filter(o => o.status === 'ACCEPTED').length,
        students_placed: new Set(placedApps.map(a => a.student_id)).size,
        overall_conversion: pct(placedApps.length, apps.length),
      },
      drive_stats: driveStats,
      branch_stats: branchStats,
      package_distribution: packageDistribution,
    };
  }

  /** Cross-service consistency check: every committed application references a decision; seats reconcile. */
  async reconcile() {
    const apps = this.db.table('applications').all();
    const decisions = new Set(this.db.table('eligibility_decisions').all().map(d => d.application_id));
    const needDecision = apps.filter(a => !['APPLIED', 'SCREENING', 'WITHDRAWN', 'EXPIRED'].includes(a.state));
    const missingDecision = needDecision.filter(a => !decisions.has(a.application_id) && !a.decision_id).map(a => a.application_id);
    const seatDrift = this.db.table('drives').all().map(d => {
      const held = apps.filter(a => a.drive_id === d.drive_id && ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'].includes(a.state)).length;
      const total = d.seats_total || d.seats + held;
      return { drive_id: d.drive_id, seats_total: total, seats_remaining: d.seats, held, consistent: total - held === d.seats };
    });
    return {
      checked_applications: apps.length,
      applications_missing_decision: missingDecision,
      seat_reconciliation: seatDrift,
      consistent: missingDecision.length === 0 && seatDrift.every(s => s.consistent),
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = ReportService;
