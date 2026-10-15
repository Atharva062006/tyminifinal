/**
 * SseService — Server-Sent Events broadcast hub for Team C (C4 outbox stream).
 *
 * Responsibilities:
 *   - Maintain a registry of connected SSE clients (Team D dashboard connections).
 *   - Broadcast named events (audit entries, state transitions) to all clients.
 *   - Send periodic heartbeats so proxies/browsers don't close idle connections.
 *
 * Usage (in routes):
 *   router.get('/stream', (req, res) => sseService.subscribe(req, res));
 *
 * Usage (from AuditService):
 *   sseService.broadcast('state_change', { application_id, from, to, ... });
 */

class SseService {
  constructor() {
    /** @type {Set<import('http').ServerResponse>} */
    this._clients = new Set();

    // Heartbeat every 15 seconds to keep connections alive through proxies
    this._heartbeatInterval = setInterval(() => {
      this._sendToAll(':heartbeat\n\n');
    }, 15000);
    if (this._heartbeatInterval.unref) this._heartbeatInterval.unref();
  }

  /**
   * Register an HTTP response as an SSE client.
   * Sets the required headers and keeps the connection open.
   *
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   */
  subscribe(req, res) {
    // SSE response headers
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx proxy buffering
    res.flushHeaders();

    // Send a "connected" event immediately so the client knows the stream is live
    this._send(res, 'connected', {
      message:   'SSE stream established — Team C placement engine',
      timestamp: new Date().toISOString(),
    });

    this._clients.add(res);

    // Clean up when the client disconnects
    req.on('close', () => {
      this._clients.delete(res);
    });
  }

  /**
   * Broadcast a named SSE event to all connected clients.
   *
   * @param {string} eventName - SSE event name (e.g. 'audit', 'state_change')
   * @param {object} data      - JSON-serialisable payload
   */
  broadcast(eventName, data) {
    if (this._clients.size === 0) return;
    const chunk = this._formatEvent(eventName, data);
    this._sendToAll(chunk);
  }

  /**
   * Number of currently connected SSE clients.
   */
  get clientCount() {
    return this._clients.size;
  }

  /**
   * Gracefully stop the heartbeat timer (call during server shutdown).
   */
  shutdown() {
    clearInterval(this._heartbeatInterval);
    // Close all client connections
    for (const res of this._clients) {
      try { res.end(); } catch { /* ignore */ }
    }
    this._clients.clear();
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  _send(res, eventName, data) {
    try {
      res.write(this._formatEvent(eventName, data));
    } catch { /* client already gone */ }
  }

  _sendToAll(chunk) {
    for (const res of this._clients) {
      try {
        res.write(chunk);
      } catch {
        this._clients.delete(res);
      }
    }
  }

  _formatEvent(eventName, data) {
    return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  }
}

module.exports = new SseService(); // singleton — shared across all route handlers
