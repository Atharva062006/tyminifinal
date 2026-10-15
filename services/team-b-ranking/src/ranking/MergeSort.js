// Team B — Stable top-down Merge Sort: deterministic O(n log n) ordering with the documented tie-break.
const { better } = require('./compare');

class MergeSort {
  rank(scored, k = scored.length) {
    const sorted = this._mergeSort(scored);
    return sorted.slice(0, k).map((s, i) => ({ ...s, rank: i + 1, algorithm: 'MERGE_SORT' }));
  }

  _mergeSort(arr) {
    if (arr.length <= 1) return arr;
    const mid = arr.length >> 1;
    return this._merge(this._mergeSort(arr.slice(0, mid)), this._mergeSort(arr.slice(mid)));
  }

  _merge(left, right) {
    const out = [];
    let i = 0; let j = 0;
    while (i < left.length && j < right.length) out.push(better(right[j], left[i]) ? right[j++] : left[i++]);
    while (i < left.length) out.push(left[i++]);
    while (j < right.length) out.push(right[j++]);
    return out;
  }
}

module.exports = MergeSort;
