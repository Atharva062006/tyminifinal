// Team B — Weighted-Score ranking: full ordering using the comparator (baseline, O(n log n)).
const { better } = require('./compare');

class WeightedScore {
  rank(scored, k = scored.length) {
    const out = [...scored].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    return out.slice(0, k).map((s, i) => ({ ...s, rank: i + 1, algorithm: 'WEIGHTED_SCORE' }));
  }
}

module.exports = WeightedScore;
