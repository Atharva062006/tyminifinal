// Team B — Adjacency List Graph for skill-to-drive mapping (baseline implementation).
// Vertices: student / drive / skill nodes. Edges: weighted match edges.
// O(V + E) memory; edge lookup is O(degree).

class AdjacencyList {
  constructor() {
    this.vertices = new Map(); // vertexId -> data
    this.edges = new Map();    // vertexId -> [ { to, weight } ]
    this.version = 1;
  }

  addVertex(id, data = {}) {
    this.vertices.set(id, data);
    if (!this.edges.has(id)) this.edges.set(id, []);
    this.version++;
  }

  hasVertex(id) { return this.vertices.has(id); }

  /** Add or replace an edge (no parallel edges). */
  addEdge(from, to, weight = 1) {
    if (!this.edges.has(from)) this.edges.set(from, []);
    const list = this.edges.get(from);
    const existing = list.find(e => e.to === to);
    if (existing) existing.weight = weight;
    else list.push({ to, weight });
    this.version++;
  }

  getWeight(from, to) {
    const e = (this.edges.get(from) || []).find(x => x.to === to);
    return e ? e.weight : 0;
  }

  getNeighbors(vertexId) {
    return this.edges.get(vertexId) || [];
  }

  /** Remove a vertex and every edge touching it. */
  removeVertex(id) {
    this.vertices.delete(id);
    this.edges.delete(id);
    for (const [, adj] of this.edges) {
      const idx = adj.findIndex(e => e.to === id);
      if (idx !== -1) adj.splice(idx, 1);
    }
    this.version++;
  }

  /** Remove all outgoing edges of a vertex (used when a profile is replaced). */
  clearEdges(id) {
    this.edges.set(id, []);
    this.version++;
  }

  edgeCount() {
    let n = 0;
    for (const adj of this.edges.values()) n += adj.length;
    return n;
  }

  getVersion() { return this.version; }

  /** Rough memory model: 16 bytes per edge + 32 per vertex. */
  memoryBytes() { return this.edgeCount() * 16 + this.vertices.size * 32; }

  toJSON() {
    return {
      version: this.version,
      vertices: this.vertices.size,
      edges: this.edgeCount(),
    };
  }
}

module.exports = AdjacencyList;
