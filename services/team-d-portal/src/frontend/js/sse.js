/**
 * Resilient Server-Sent Events (SSE) Client for Team D Frontend.
 * Listens for state mutations broadcast from Team C's outbox.
 */

class SSEClient {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 15000;
    this.reconnectTimer = null;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      window.store.set('streamStatus', 'RECONNECTING');
      this.eventSource = new EventSource('/api/v1/ui/stream');

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        window.store.update({
          streamStatus: 'LIVE',
          lastEventTime: new Date().toISOString()
        });
        console.log('[SSE] Live stream connected to Team D BFF');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (e) {
          console.warn('[SSE] Failed to parse SSE event payload:', event.data);
        }
      };

      this.eventSource.onerror = () => {
        this.eventSource.close();
        window.store.set('streamStatus', 'DISCONNECTED');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[SSE] EventSource init failed:', err);
      this.scheduleReconnect();
    }
  }

  handleEvent(data) {
    const now = new Date().toISOString();
    window.store.set('lastEventTime', now);

    if (data.type === 'stream_status') {
      window.store.set('streamStatus', data.status);
      return;
    }

    // Trigger toast & refresh relevant view components
    if (data.table_name || data.action || data.type === 'audit') {
      const actor = data.actor || 'System';
      const action = data.action || 'Data mutated';
      const entity = data.table_name || 'record';
      
      window.toast.info(`Live Update: ${action} on ${entity} by ${actor}`);

      // Emit event on store so active views can auto-refresh
      window.store.emit('dataMutation', data);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts++), this.maxReconnectDelay);
    console.log(`[SSE] Reconnecting in ${Math.round(delay / 1000)}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    window.store.set('streamStatus', 'OFFLINE');
  }
}

window.sseClient = new SSEClient();
