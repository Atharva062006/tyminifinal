// Team B — Adjacency Matrix Graph (baseline for the list-vs-matrix comparison experiment).
// O(1) edge lookup, O(V^2) memory. Rows grow incrementally (no full re-allocation per vertex).

class AdjacencyMatrix {
  constructor(vertexIds = []) {
    this.vertexIndex = new Map(); // id -> index
    this.vertices = [];
    this.matrix = [];
    this.version = 1;
    vertexIds.forEach(id => this.addVertex(id));
  }

  addVertex(id, data = {}) {
    if (this.vertexIndex.has(id)) return;
    const idx = this.vertices.length;
    this.vertexIndex.set(id, idx);
    this.vertices.push({ id, data });
    for (const row of this.matrix) row.push(0);
    this.matrix.push(new Array(idx + 1).fill(0));
    this.version++;
  }

  addEdge(from, to, weight = 1) {
    const fi = this.vertexIndex.get(from);
    const ti = this.vertexIndex.get(to);
    if (fi === undefined || ti === undefined) throw new Error('Vertex not found');
    this.matrix[fi][ti] = weight;
    this.version++;
  }

  getWeight(from, to) {
    const fi = this.vertexIndex.get(from);
    const ti = this.vertexIndex.get(to);
    if (fi === undefined || ti === undefined) return 0;
    return this.matrix[fi][ti];
  }

  getNeighbors(fromId) {
    const fi = this.vertexIndex.get(fromId);
    if (fi === undefined) return [];
    const out = [];
    for (let j = 0; j < this.vertices.length; j++) {
      if (this.matrix[fi][j] > 0) out.push({ to: this.vertices[j].id, weight: this.matrix[fi][j] });
    }
    return out;
  }

  getVersion() { return this.version; }

  /** Rough memory model: 8 bytes per matrix cell. */
  memoryBytes() { return this.vertices.length * this.vertices.length * 8; }
}

module.exports = AdjacencyMatrix;
