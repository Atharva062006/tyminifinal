// Team B — Trie for skill-tag autocomplete / prefix lookup. O(L) per operation.

class TrieNode { constructor() { this.children = new Map(); this.word = null; this.count = 0; } }

class Trie {
  constructor() { this.root = new TrieNode(); this.size = 0; }

  insert(word) {
    let n = this.root;
    for (const ch of word.toLowerCase()) {
      if (!n.children.has(ch)) n.children.set(ch, new TrieNode());
      n = n.children.get(ch);
    }
    if (n.word === null) { n.word = word; this.size++; }
    n.count++;
  }

  startsWith(prefix, limit = 20) {
    let n = this.root;
    for (const ch of prefix.toLowerCase()) {
      n = n.children.get(ch);
      if (!n) return [];
    }
    const out = [];
    const walk = node => {
      if (out.length >= limit) return;
      if (node.word !== null) out.push({ skill: node.word, students: node.count });
      for (const c of [...node.children.keys()].sort()) walk(node.children.get(c));
    };
    walk(n);
    return out;
  }
}

module.exports = Trie;
