// Team B — AVL tree (self-balancing BST) used for the shortlist index. O(log n) insert/search.

class Node {
  constructor(key, value) { this.key = key; this.value = value; this.left = null; this.right = null; this.height = 1; }
}

const h = n => (n ? n.height : 0);
const upd = n => { n.height = 1 + Math.max(h(n.left), h(n.right)); };
const bal = n => (n ? h(n.left) - h(n.right) : 0);

function rotR(y) { const x = y.left; y.left = x.right; x.right = y; upd(y); upd(x); return x; }
function rotL(x) { const y = x.right; x.right = y.left; y.left = x; upd(x); upd(y); return y; }

function rebalance(n) {
  upd(n);
  const b = bal(n);
  if (b > 1) { if (bal(n.left) < 0) n.left = rotL(n.left); return rotR(n); }
  if (b < -1) { if (bal(n.right) > 0) n.right = rotR(n.right); return rotL(n); }
  return n;
}

class AVLTree {
  constructor() { this.root = null; this.size = 0; this.comparisons = 0; }

  insert(key, value) {
    const go = (n) => {
      if (!n) { this.size++; return new Node(key, value); }
      if (key < n.key) n.left = go(n.left);
      else if (key > n.key) n.right = go(n.right);
      else { n.value = value; return n; }
      return rebalance(n);
    };
    this.root = go(this.root);
  }

  get(key) {
    let n = this.root;
    while (n) {
      this.comparisons++;
      if (key === n.key) return n.value;
      n = key < n.key ? n.left : n.right;
    }
    return undefined;
  }

  delete(key) {
    let removed = false;
    const minNode = n => { while (n.left) n = n.left; return n; };
    const go = (n, k) => {
      if (!n) return null;
      if (k < n.key) n.left = go(n.left, k);
      else if (k > n.key) n.right = go(n.right, k);
      else {
        removed = true;
        if (!n.left || !n.right) return n.left || n.right;
        const m = minNode(n.right);
        n.key = m.key; n.value = m.value;
        n.right = go(n.right, m.key);
      }
      return rebalance(n);
    };
    this.root = go(this.root, key);
    if (removed) this.size--;
    return removed;
  }

  /** Delete every key with the given prefix (used for per-drive cache invalidation). */
  deletePrefix(prefix) {
    const keys = [];
    const walk = n => { if (!n) return; walk(n.left); if (n.key.startsWith(prefix)) keys.push(n.key); walk(n.right); };
    walk(this.root);
    keys.forEach(k => this.delete(k));
    return keys.length;
  }

  clear() { this.root = null; this.size = 0; }
  height() { return h(this.root); }
  memoryBytes() { return this.size * 56; }
}

module.exports = AVLTree;
