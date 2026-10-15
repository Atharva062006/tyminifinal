// Team B — shared comparator. Documented tie-break rule: score DESC, then student_id ASC.
// Scores are compared after rounding to 1e-9 so floating-point noise cannot reorder candidates.
function better(a, b) {
  const d = Math.round((a.total_score - b.total_score) * 1e9);
  if (d !== 0) return d > 0;
  return a.student_id < b.student_id;
}

const TIE_BREAK_RULE = 'total_score DESC, then student_id ASC';

module.exports = { better, TIE_BREAK_RULE };
