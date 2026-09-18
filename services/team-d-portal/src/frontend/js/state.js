/**
 * Central State Store for Team D Frontend SPA.
 * Manages reactive UI state, active user, toast alerts, cached drives, and live stream status.
 */

class StateStore {
  constructor() {
    this.listeners = new Map();
    this.state = {
      user: window.api.getUser(),
      currentRoute: window.location.hash || '#/login',
      streamStatus: 'OFFLINE', // 'LIVE', 'RECONNECTING', 'DISCONNECTED', 'OFFLINE'
      lastEventTime: null,
      drivesCache: [],
      activeModal: null,
      isMobileSidebarOpen: false
    };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.emit(key, value);
  }

  update(patch) {
    Object.assign(this.state, patch);
    for (const key of Object.keys(patch)) {
      this.emit(key, patch[key]);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
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
