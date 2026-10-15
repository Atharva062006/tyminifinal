/**
 * BTreeIndex — classic B-tree (CLRS formulation, minimum degree t) for range queries and sorted lookups.
 *
 * Used for:
 *   - CGPA range queries   (students table)
 *   - Date range queries   (drives, applications, audit_log)
 *   - State-based lookups  (applications.state)
 *
 * Every key maps to a Set of primary keys (one-to-many support). Keys live in all nodes (B-tree, not B+-tree).
 * Insert splits full nodes on the way down (single pass); delete removes the pk and drops the key's value set when
 * empty (lazy structural delete — empty keys are skipped by search / range queries and reused by later inserts).
 *
 * Persistence: serialize() / deserialize() for saving to disk.
 */

class BTreeNode {
  constructor(isLeaf = true) {
    this.isLeaf   = isLeaf;
    this.keys     = [];      // sorted key values
    this.values   = [];      // parallel array of Set<pk>
    this.children = [];      // child BTreeNode references (internal nodes only)
  }
}

class BTreeIndex {
  /**
   * @param {string} indexName - Name for serialization
   * @param {number} order     - B-tree order (max children per node = order)
   */
  constructor(indexName = 'unnamed', order = 5) {
    this.indexName = indexName;
    this.order     = order;
    this.t         = Math.max(2, Math.ceil(order / 2)); // minimum degree
    this.root      = new BTreeNode(true);
    this.size      = 0; // total number of key-pk pairs
  }

  // ─── Insert ───────────────────────────────────────────────────────────────

  /**
   * Insert a (key, pk) pair.
   * @param {*}      key - Comparable value (number, string, ISO date string)
   * @param {string} pk  - Primary key of the record
   */
  insert(key, pk) {
    if (this.root.keys.length === 2 * this.t - 1) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(this.root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
    }
    this._insertNonFull(this.root, key, pk);
  }

  _insertNonFull(node, key, pk) {
    // Existing key in this node: just add the pk
    let i = 0;
    while (i < node.keys.length && this._cmp(key, node.keys[i]) > 0) i++;
    if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) {
      if (!node.values[i].has(pk)) { node.values[i].add(pk); this.size++; }
      return;
    }

    if (node.isLeaf) {
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, new Set([pk]));
      this.size++;
      return;
    }

    if (node.children[i].keys.length === 2 * this.t - 1) {
      this._splitChild(node, i);
      const c = this._cmp(key, node.keys[i]);
      if (c === 0) {
        if (!node.values[i].has(pk)) { node.values[i].add(pk); this.size++; }
        return;
      }
      if (c > 0) i++;
    }
    this._insertNonFull(node.children[i], key, pk);
  }

  /** Split the full child parent.children[idx]; its median key moves up into parent. */
  _splitChild(parent, idx) {
    const t = this.t;
    const child = parent.children[idx];
    const sibling = new BTreeNode(child.isLeaf);

    sibling.keys   = child.keys.splice(t);        // keys t .. 2t-2
    sibling.values = child.values.splice(t);
    const midKey   = child.keys.pop();            // key t-1 (median)
    const midVal   = child.values.pop();
    if (!child.isLeaf) sibling.children = child.children.splice(t);

    parent.keys.splice(idx, 0, midKey);
    parent.values.splice(idx, 0, midVal);
    parent.children.splice(idx + 1, 0, sibling);
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  /**
   * Exact lookup — returns Set<pk> for the given key, or empty Set.
   */
  search(key) {
    let node = this.root;
    while (node) {
      let i = 0;
      while (i < node.keys.length && this._cmp(key, node.keys[i]) > 0) i++;
      if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) return node.values[i];
      if (node.isLeaf) return new Set();
      node = node.children[i];
    }
    return new Set();
  }

  /**
   * Range query — returns all PKs where minKey <= key <= maxKey.
   * Pass null for unbounded ends.
   * @returns {Set<string>}
   */
  rangeQuery(minKey, maxKey) {
    const result = new Set();
    this._rangeTraverse(this.root, minKey, maxKey, result);
    return result;
  }

  _rangeTraverse(node, minKey, maxKey, result) {
    const n = node.keys.length;
    for (let i = 0; i < n; i++) {
      const key = node.keys[i];
      const aboveMin = minKey === null || minKey === undefined || this._cmp(key, minKey) >= 0;
      const belowMax = maxKey === null || maxKey === undefined || this._cmp(key, maxKey) <= 0;
      // Left subtree can only contain keys < key; skip it when even `key` is below the range
      if (!node.isLeaf && aboveMin) this._rangeTraverse(node.children[i], minKey, maxKey, result);
      if (aboveMin && belowMax) for (const pk of node.values[i]) result.add(pk);
      if (!belowMax) return; // everything to the right is larger still
    }
    if (!node.isLeaf) this._rangeTraverse(node.children[n], minKey, maxKey, result);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Remove a (key, pk) pair from the index (lazy structural delete).
   */
  delete(key, pk) {
    let node = this.root;
    while (node) {
      let i = 0;
      while (i < node.keys.length && this._cmp(key, node.keys[i]) > 0) i++;
      if (i < node.keys.length && this._cmp(key, node.keys[i]) === 0) {
        if (node.values[i].delete(pk)) this.size = Math.max(0, this.size - 1);
        return;
      }
      if (node.isLeaf) return;
      node = node.children[i];
    }
  }

  // ─── Comparison ────────────────────────────────────────────────────────────

  _cmp(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const sa = String(a), sb = String(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  /** Tree height (root = 1). Used by diagnostics / benchmarks. */
  height() {
    let h = 1;
    let n = this.root;
    while (!n.isLeaf) { n = n.children[0]; h++; }
    return h;
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  serialize() {
    return JSON.stringify({ indexName: this.indexName, order: this.order, size: this.size, root: this._serializeNode(this.root) });
  }

  _serializeNode(node) {
    return {
      isLeaf:   node.isLeaf,
      keys:     node.keys,
      values:   node.values.map(s => [...s]),
      children: node.isLeaf ? [] : node.children.map(c => this._serializeNode(c)),
    };
  }

  static deserialize(json) {
    const data  = typeof json === 'string' ? JSON.parse(json) : json;
    const index = new BTreeIndex(data.indexName, data.order);
    index.size  = data.size;
    index.root  = BTreeIndex._deserializeNode(data.root);
    return index;
  }

  static _deserializeNode(data) {
    const node    = new BTreeNode(data.isLeaf);
    node.keys     = data.keys;
    node.values   = data.values.map(arr => new Set(arr));
    node.children = data.isLeaf ? [] : data.children.map(c => BTreeIndex._deserializeNode(c));
    return node;
  }

  /** In-order traversal to get all key-pk pairs (useful for debugging) */
  toSortedArray() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  _inOrder(node, result) {
    if (!node) return;
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf) this._inOrder(node.children[i], result);
      for (const pk of node.values[i]) result.push({ key: node.keys[i], pk });
    }
    if (!node.isLeaf) this._inOrder(node.children[node.keys.length], result);
  }
}

module.exports = BTreeIndex;
