/**
 * SSE Proxy Service for Team D BFF.
 * Connects to Team C's outbox SSE stream (port 3003/api/v1/stream) and relays real-time placement events to the
 * browser. Team C emits NAMED events (`event: audit`); browsers listening with `onmessage` only receive unnamed
 * events, so each frame is converted to a JSON message with a `type` field. Notification events are delivered
 * only to their recipient (the stream accepts `?token=` because EventSource cannot set headers).
 */
const http = require('http');

const TEAM_C_STREAM_URL = process.env.TEAM_C_STREAM_URL || 'http://localhost:3003/api/v1/stream';

class SSEProxyService {
  constructor() {
    this.clients = new Map(); // res -> { user }
    this.upstreamReq = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.lastEventTime = new Date().toISOString();

    // Heartbeat as a real message so the browser can detect staleness (unref: never blocks process exit)
    this.heartbeatTimer = setInterval(() => {
      this.broadcastJson({ type: 'heartbeat', upstream: this.isConnected ? 'LIVE' : 'DISCONNECTED', timestamp: new Date().toISOString() });
    }, 15000);
    this.heartbeatTimer.unref();

    if (process.env.NODE_ENV !== 'test') this.connectUpstream();
  }

  connectUpstream() {
    if (this.upstreamReq) { try { this.upstreamReq.destroy(); } catch { /* ignore */ } }
    try {
      const url = new URL(TEAM_C_STREAM_URL);
      const req = http.get({ hostname: url.hostname, port: url.port, path: url.pathname, headers: { Accept: 'text/event-stream' } }, (res) => {
        if (res.statusCode !== 200) { this.handleDisconnect('Non-200 status from Team C stream'); return; }
        this.isConnected = true;
        this.broadcastJson({ type: 'stream_status', status: 'LIVE', message: 'Connected to Team C outbox' });
        let buffer = '';
        res.on('data', (chunk) => {
          this.lastEventTime = new Date().toISOString();
          buffer += chunk.toString();
          const parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (const part of parts) if (part.trim()) this.relayFrame(part);
        });
        res.on('end', () => this.handleDisconnect('Team C stream ended'));
        res.on('error', (err) => this.handleDisconnect(`Team C stream error: ${err.message}`));
      });
      req.on('error', (err) => this.handleDisconnect(`Upstream connect error: ${err.message}`));
      req.setTimeout(60000, () => { req.destroy(); this.handleDisconnect('Upstream SSE read timeout'); });
      this.upstreamReq = req;
    } catch (err) {
      this.handleDisconnect(`Failed to initiate SSE upstream: ${err.message}`);
    }
  }

  /** Convert one upstream frame (`event: x` + `data: {...}`) into a typed message and route it. */
  relayFrame(frame) {
    if (frame.startsWith(':')) return; // upstream comment / heartbeat
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    let payload = {};
    try { payload = data ? JSON.parse(data) : {}; } catch { payload = { raw: data }; }
    if (event === 'connected') return;

    // the event name always wins: Team C notification payloads carry their own `type` (e.g. OFFER_ISSUED) -> exposed as `kind`
    const { type: kind, ...rest } = payload;
    const message = { ...rest, ...(kind ? { kind } : {}), type: event, received_at: new Date().toISOString() };
    if (event === 'notification') {
      for (const [res, meta] of this.clients) if (meta.user && meta.user.id === payload.recipient_id) this._write(res, message);
      return;
    }
    this.broadcastJson(message);
  }

  handleDisconnect(reason) {
    if (this.isConnected) {
      console.warn(`[SSE Proxy] Upstream disconnected: ${reason}`);
      this.isConnected = false;
      this.broadcastJson({ type: 'stream_status', status: 'DISCONNECTED', last_event_time: this.lastEventTime, message: reason });
    }
    if (!this.reconnectTimer && process.env.NODE_ENV !== 'test') {
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connectUpstream(); }, 5000);
      this.reconnectTimer.unref();
    }
  }

  /** Subscribe a new browser client response object */
  subscribe(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.set(res, { user: req.user || null });
    this._write(res, {
      type: 'connected',
      service: 'team-d-portal',
      upstream_status: this.isConnected ? 'LIVE' : 'RECONNECTING',
      last_event_time: this.lastEventTime,
      authenticated: Boolean(req.user),
      timestamp: new Date().toISOString(),
    });
    req.on('close', () => this.clients.delete(res));
  }

  _write(res, obj) {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { this.clients.delete(res); }
  }

  broadcastJson(obj) {
    for (const res of this.clients.keys()) this._write(res, obj);
  }

  shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.upstreamReq) this.upstreamReq.destroy();
    for (const res of this.clients.keys()) { try { res.end(); } catch { /* ignore */ } }
    this.clients.clear();
  }
}

module.exports = new SSEProxyService();
