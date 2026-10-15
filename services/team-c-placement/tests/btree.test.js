const BTreeIndex = require('../src/db/indexes/BTreeIndex');
const HashIndex = require('../src/db/indexes/HashIndex');

describe('BTreeIndex', () => {
  test('stays correct across thousands of inserts with duplicates (regression: split bug)', () => {
    const idx = new BTreeIndex('t');
    const expected = new Map();
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    for (let i = 0; i < 5000; i++) {
      const key = rnd() % 700;
      idx.insert(key, `pk${i}`);
      if (!expected.has(key)) expected.set(key, new Set());
      expected.get(key).add(`pk${i}`);
    }
    expect(idx.size).toBe(5000);
    for (const [k, set] of expected) expect([...idx.search(k)].sort()).toEqual([...set].sort());
    const sorted = idx.toSortedArray().map(x => x.key);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
    expect(idx.height()).toBeLessThan(8);
  });

  test('range queries are inclusive, support open ends and string (ISO date) keys', () => {
    const idx = new BTreeIndex('t');
    for (let i = 0; i < 200; i++) idx.insert(i, `n${i}`);
    expect(idx.rangeQuery(10, 14).size).toBe(5);
    expect(idx.rangeQuery(null, 4).size).toBe(5);
    expect(idx.rangeQuery(195, null).size).toBe(5);
    const dates = new BTreeIndex('d');
    ['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z'].forEach((d, i) => dates.insert(d, `a${i}`));
    expect([...dates.rangeQuery('2026-01-15T00:00:00Z', '2026-03-01T00:00:00Z')].sort()).toEqual(['a1', 'a2']);
  });

  test('delete removes only the given pk; serialize round-trips', () => {
    const idx = new BTreeIndex('t');
    idx.insert('open', 'a'); idx.insert('open', 'b'); idx.insert('closed', 'c');
    idx.delete('open', 'a');
    expect([...idx.search('open')]).toEqual(['b']);
    const copy = BTreeIndex.deserialize(idx.serialize());
    expect([...copy.search('closed')]).toEqual(['c']);
  });
});

describe('HashIndex', () => {
  test('lookup, multi-pk keys, delete and rehash', () => {
    const h = new HashIndex('h');
    for (let i = 0; i < 500; i++) h.insert(`k${i % 100}`, `pk${i}`);
    expect(h.lookup('k7').size).toBe(5);
    h.delete('k7', 'pk7');
    expect(h.lookup('k7').size).toBe(4);
    expect(h.lookup('missing').size).toBe(0);
  });
});
