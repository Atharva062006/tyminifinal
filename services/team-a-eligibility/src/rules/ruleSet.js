// Team A — Rule set builder: converts a drive's criteria into an ordered list of rules.
// Hard rules disqualify a student; the soft rule (skills) can only downgrade to CONDITIONAL.

const RULE_SET_VERSION = '1.2.0';

function normalise(criteria = {}) {
  return {
    min_cgpa: criteria.min_cgpa ?? 0,
    max_backlogs: criteria.max_backlogs ?? 99,
    branches: criteria.branches || criteria.allowed_branches || [],
    min_attendance: criteria.min_attendance ?? 0,
    required_skills: criteria.required_skills || [],
  };
}

function skillMatch(student, c) {
  if (c.required_skills.length === 0) return { matched: [], ratio: 1 };
  const have = new Set((student.skills || []).map(s => String(s).toLowerCase()));
  const matched = c.required_skills.filter(s => have.has(String(s).toLowerCase()));
  return { matched, ratio: matched.length / c.required_skills.length };
}

/**
 * @returns {Array<{code,weight,hard,evaluate(student):boolean,fail(student):string,pass():string,required,actual(student)}>}
 */
function buildRules(criteriaIn) {
  const c = normalise(criteriaIn);
  return [
    {
      code: 'CGPA', weight: 3, hard: true,
      evaluate: s => Number(s.cgpa) >= c.min_cgpa,
      pass: () => `CGPA >= ${c.min_cgpa}`,
      fail: s => `CGPA ${s.cgpa} < cutoff ${c.min_cgpa}`,
      required: `>= ${c.min_cgpa}`, actual: s => s.cgpa,
    },
    {
      code: 'BACKLOGS', weight: 2, hard: true,
      evaluate: s => Number(s.backlogs || 0) <= c.max_backlogs,
      pass: () => `Backlogs <= ${c.max_backlogs}`,
      fail: s => `Backlogs ${s.backlogs || 0} > allowed ${c.max_backlogs}`,
      required: `<= ${c.max_backlogs}`, actual: s => s.backlogs || 0,
    },
    {
      code: 'BRANCH', weight: 2, hard: true,
      evaluate: s => c.branches.length === 0 || c.branches.includes(s.branch),
      pass: () => 'Branch matches allow-list',
      fail: s => `Branch '${s.branch}' not in allow-list [${c.branches.join(', ')}]`,
      required: c.branches.length ? c.branches.join(', ') : 'Any', actual: s => s.branch,
    },
    {
      code: 'ATTENDANCE', weight: 1, hard: true,
      evaluate: s => s.attendance == null || Number(s.attendance) >= c.min_attendance,
      pass: () => `Attendance >= ${c.min_attendance}%`,
      fail: s => `Attendance ${s.attendance}% < required ${c.min_attendance}%`,
      required: `>= ${c.min_attendance}%`, actual: s => (s.attendance == null ? 'n/a' : s.attendance),
    },
    {
      code: 'SKILLS', weight: 2, hard: false,
      evaluate: s => skillMatch(s, c).ratio >= 0.5,
      pass: () => 'Skill tags satisfy at least 50% of requirement',
      fail: s => `Missing required skills: ${c.required_skills.filter(x => !skillMatch(s, c).matched.includes(x)).join(', ')}`,
      required: c.required_skills.length ? c.required_skills.join(', ') : 'None',
      actual: s => (s.skills || []).join(', ') || 'none',
    },
  ];
}

module.exports = { buildRules, normalise, RULE_SET_VERSION };
