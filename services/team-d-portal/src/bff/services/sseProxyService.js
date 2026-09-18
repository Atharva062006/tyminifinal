/**
 * SSE Proxy Service for Team D BFF.
 * Connects to Team C's outbox SSE stream (port 3003/api/v1/stream)
 * and relays real-time placement events to all active UI clients.
 */
const http = require('http');

const TEAM_C_STREAM_URL = process.env.TEAM_C_STREAM_URL || 'http://localhost:3003/api/v1/stream';

class SSEProxyService {
  constructor() {
    this.clients = new Set();
    this.upstreamReq = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastEventTime = new Date().toISOString();

    // Start heartbeat (unref so it does not prevent process exit or hang tests)
    this.heartbeatTimer = setInterval(() => {
      this.broadcastComment('heartbeat');
    }, 15000);
    this.heartbeatTimer.unref();

    // Initial upstream connection attempt (skip auto connect in test env)
    if (process.env.NODE_ENV !== 'test') {
      this.connectUpstream();
    }
  }

  /**
   * Connect to Team C's SSE stream
   */
  connectUpstream() {
    if (this.upstreamReq) {
      try { this.upstreamReq.destroy(); } catch {}
    }

    try {
      const url = new URL(TEAM_C_STREAM_URL);
      const req = http.get({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { 'Accept': 'text/event-stream' }
      }, (res) => {
        if (res.statusCode !== 200) {
          this.handleDisconnect('Non-200 status from Team C stream');
          return;
        }

        this.isConnected = true;
        this.broadcastJson({ type: 'stream_status', status: 'LIVE', message: 'Connected to Team C outbox' });

        let buffer = '';
        res.on('data', (chunk) => {
          this.lastEventTime = new Date().toISOString();
          const text = chunk.toString();
          buffer += text;

          // Split by double newline for SSE frames
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep remainder

          for (const part of parts) {
            if (part.trim()) {
              this.broadcastRaw(part + '\n\n');
            }
          }
        });

        res.on('end', () => this.handleDisconnect('Team C stream ended'));
        res.on('error', (err) => this.handleDisconnect(`Team C stream error: ${err.message}`));
      });

      req.on('error', (err) => this.handleDisconnect(`Upstream connect error: ${err.message}`));
      req.setTimeout(60000, () => {
        req.destroy();
        this.handleDisconnect('Upstream SSE read timeout');
      });

      this.upstreamReq = req;
    } catch (err) {
      this.handleDisconnect(`Failed to initiate SSE upstream: ${err.message}`);
    }
  }

  handleDisconnect(reason) {
    if (this.isConnected) {
      console.warn(`[SSE Proxy] Upstream disconnected: ${reason}`);
      this.isConnected = false;
      this.broadcastJson({
        type: 'stream_status',
        status: 'DISCONNECTED',
        last_event_time: this.lastEventTime,
        message: reason
      });
    }

    if (!this.reconnectTimer && process.env.NODE_ENV !== 'test') {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connectUpstream();
      }, 5000);
      this.reconnectTimer.unref();
    }
  }

  /**
   * Subscribe a new browser client response object
   */
  subscribe(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.add(res);

    // Send initial connection welcome message
    const initialPayload = JSON.stringify({
      type: 'connected',
      service: 'team-d-portal',
      upstream_status: this.isConnected ? 'LIVE' : 'RECONNECTING',
      last_event_time: this.lastEventTime,
      timestamp: new Date().toISOString()
    });
    res.write(`data: ${initialPayload}\n\n`);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcast raw string to all subscribers
   */
  broadcastRaw(rawString) {
    for (const res of this.clients) {
      try {
        res.write(rawString);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  /**
   * Broadcast JSON payload as an SSE 'message'
   */
  broadcastJson(obj) {
    this.broadcastRaw(`data: ${JSON.stringify(obj)}\n\n`);
  }

  /**
   * Broadcast SSE comment
   */
  broadcastComment(comment) {
    this.broadcastRaw(`:${comment}\n\n`);
  }

  shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.upstreamReq) this.upstreamReq.destroy();
    for (const res of this.clients) {
      try { res.end(); } catch {}
    }
    this.clients.clear();
  }
}

module.exports = new SSEProxyService();
