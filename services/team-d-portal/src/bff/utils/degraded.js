/**
 * Request-scoped "degraded mode" tracker (AsyncLocalStorage).
 * When a client falls back to a mock / local adapter it records the source here and the response
 * envelope exposes it as meta.degraded so the UI can show an honest banner instead of silently
 * presenting fallback data as live data.
 */
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function run(next) {
  als.run({ sources: new Map() }, next);
}

function mark(source, reason) {
  const store = als.getStore();
  if (store) store.sources.set(source, reason || 'fallback');
}

function current() {
  const store = als.getStore();
  if (!store || store.sources.size === 0) return undefined;
  return [...store.sources.entries()].map(([source, reason]) => ({ source, reason }));
}

module.exports = { run, mark, current };
