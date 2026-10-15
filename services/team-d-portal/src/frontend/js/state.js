/**
 * Central State Store for the Team D Frontend SPA.
 * Reactive UI state: active user, live-stream status, degraded-engine flags, unread notification count.
 */
class StateStore {
  constructor() {
    this.listeners = new Map();
    this.state = {
      user: window.api.isAuthenticated() ? window.api.getUser() : null,
      streamStatus: 'OFFLINE', // 'LIVE', 'RECONNECTING', 'DISCONNECTED', 'OFFLINE'
      lastEventTime: null,
      degraded: null,
      unreadCount: 0,
    };
  }

  get(key) { return this.state[key]; }

  set(key, value) {
    this.state[key] = value;
    this.emit(key, value);
  }

  update(patch) {
    Object.assign(this.state, patch);
    for (const key of Object.keys(patch)) this.emit(key, patch[key]);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  emit(key, value) {
    if (this.listeners.has(key)) {
      for (const cb of this.listeners.get(key)) {
        try { cb(value, this.state); } catch (e) { console.error(e); }
      }
    }
  }
}

window.store = new StateStore();
