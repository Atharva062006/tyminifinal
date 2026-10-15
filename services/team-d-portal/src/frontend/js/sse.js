/**
 * Resilient Server-Sent Events client (D3). Messages are typed JSON from the BFF stream relay:
 *   state_change | audit | notification | heartbeat | stream_status | connected
 * Reconnects with back-off, marks the stream stale when no heartbeat arrives, and debounces view refreshes.
 */
class SSEClient {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 15000;
    this.reconnectTimer = null;
    this.staleTimer = null;
    this.refreshTimer = null;
  }

  connect() {
    if (this.eventSource) this.eventSource.close();
    const token = window.api.rawToken();
    if (!token) return;
    try {
      window.store.set('streamStatus', 'RECONNECTING');
      this.eventSource = new EventSource(`/api/v1/ui/stream?token=${encodeURIComponent(token)}`);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        window.store.update({ streamStatus: 'LIVE', lastEventTime: new Date().toISOString() });
        this.armStaleTimer();
        window.components.refreshHeader();
      };

      this.eventSource.onmessage = (event) => {
        try { this.handleEvent(JSON.parse(event.data)); } catch { /* ignore malformed frame */ }
      };

      this.eventSource.onerror = () => {
        this.eventSource.close();
        window.store.set('streamStatus', 'DISCONNECTED');
        window.components.refreshHeader();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  armStaleTimer() {
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => { window.components.refreshHeader(); }, 62000); // header shows "Stale"
  }

  handleEvent(data) {
    window.store.set('lastEventTime', new Date().toISOString());
    this.armStaleTimer();

    if (data.type === 'stream_status') {
      window.store.set('streamStatus', data.status === 'LIVE' ? 'LIVE' : 'RECONNECTING');
      window.components.refreshHeader();
      return;
    }
    if (data.type === 'heartbeat' || data.type === 'connected') { window.components.refreshHeader(); return; }

    const me = window.store.get('user');
    if (data.type === 'notification') {
      window.toast.info(data.title || 'New notification');
      window.components.refreshUnread();
      window.store.emit('notificationArrived', data);
      return;
    }
    if (data.type === 'state_change') {
      const mine = me && me.role === 'student' && data.student_id === me.id;
      if (mine || (me && me.role !== 'student')) {
        window.store.emit('dataMutation', data);
        this.scheduleRefresh();
      }
      return;
    }
    if (data.type === 'audit' && me && me.role !== 'student') {
      window.store.emit('dataMutation', data);
      this.scheduleRefresh();
    }
  }

  /** Re-render the active list/dashboard view at most once every 1.5 s, but never while a modal or form has focus. */
  scheduleRefresh() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      if (document.querySelector('.modal-backdrop.open')) return;
      const active = document.activeElement;
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
      if (window.router && window.router.refreshable) window.router.handleRoute({ silent: true });
    }, 1500);
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts++), this.maxReconnectDelay);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.staleTimer);
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
    window.store.set('streamStatus', 'OFFLINE');
  }
}

window.sseClient = new SSEClient();
