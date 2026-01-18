import crypto from 'crypto';

function b64url(buf){
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function b64urlJson(obj){
  return b64url(JSON.stringify(obj));
}

function fromB64url(str){
  const s = String(str || '').replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length % 4;
  const padded = pad ? (s + '='.repeat(4 - pad)) : s;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function hmac(secret, msg){
  return b64url(crypto.createHmac('sha256', secret).update(msg).digest());
}

export function createCsrfToken(secret, { ttlMinutes = 120 } = {}){
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + ttlMinutes * 60,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const p = b64urlJson(payload);
  const sig = hmac(secret, p);
  return `${p}.${sig}`;
}

export function verifyCsrfToken(token, secret){
  const t = String(token || '');
  const parts = t.split('.');
  if(parts.length !== 2) return { ok: false, error: 'BAD_FORMAT' };
  const [p, sig] = parts;
  const expected = hmac(secret, p);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if(a.length !== b.length) return { ok: false, error: 'BAD_SIG' };
  if(!crypto.timingSafeEqual(a,b)) return { ok: false, error: 'BAD_SIG' };

  let payload;
  try{ payload = JSON.parse(fromB64url(p)); }
  catch{ return { ok: false, error: 'BAD_PAYLOAD' }; }

  const now = Math.floor(Date.now()/1000);
  if(!payload || typeof payload !== 'object') return { ok: false, error: 'BAD_PAYLOAD' };
  if(typeof payload.exp !== 'number' || payload.exp < now) return { ok: false, error: 'EXPIRED' };
  return { ok: true, payload };
}

/**
 * CSRF middleware (double-submit style, header-based):
 * - Frontend fetches /api/csrf to obtain a short-lived token.
 * - For unsafe methods, frontend must send header: X-CSRF-Token.
 *
 * This blocks classic CSRF via cross-site <form> POST because custom headers
 * cannot be sent cross-site without CORS preflight + reading the token.
 */
export function csrfRequired({ secret, ignore = [] } = {}){
  if(!secret) throw new Error('csrfRequired: secret is required');
  const ignoreSet = new Set(ignore);
  return (req, res, next) => {
    const m = String(req.method || 'GET').toUpperCase();
    if(m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
    const path = req.path || '';
    if(ignoreSet.has(path)) return next();

    const token = req.get('x-csrf-token');
    const v = verifyCsrfToken(token, secret);
    if(!v.ok){
      return res.status(403).json({ error: 'CSRF', reason: v.error });
    }
    return next();
  };
}
