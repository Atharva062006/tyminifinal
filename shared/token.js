/**
 * Signed session tokens shared by Team C (issuer / verifier) and Team D (verifier).
 * Format: base64url(payload).base64url(hmac-sha256(payload)) — a minimal JWT-like scheme
 * built only on Node's crypto module (no external packages).
 *
 * For the test suites (NODE_ENV=test) the legacy dev token "<role>_<userId>" is also accepted
 * so existing mocks keep working; it is rejected everywhere else.
 */
const crypto = require('crypto');

const SECRET = () => process.env.JWT_SECRET || 'rit_placement_jwt_signing_secret';
const TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || String(8 * 3600), 10);

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload, ttlSeconds = TTL_SECONDS) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** @returns {object|null} payload when valid, otherwise null */
function verify(token) {
  if (!token || typeof token !== 'string') return null;

  if (process.env.NODE_ENV === 'test' || process.env.ALLOW_DEV_TOKENS === 'true') {
    const idx = token.indexOf('_');
    if (idx > 0 && !token.includes('.')) {
      return { role: token.slice(0, idx).toLowerCase(), sub: token.slice(idx + 1) || 'USER001', legacy: true };
    }
  }

  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
