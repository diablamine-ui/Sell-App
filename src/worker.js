// Dilam B' — serveur Cloudflare (Worker)
// Rôle : seul point d'accès aux données. Le navigateur ne détient aucun secret.
//
// Secrets (saisis par le propriétaire dans le tableau de bord Cloudflare, jamais dans ce code) :
//   ADMIN_EMAIL      adresse qui reçoit les codes de connexion admin
//   RESEND_API_KEY   clé d'envoi d'emails (Resend)
//   META_CAPI_TOKEN  jeton Meta Conversions API
// Variables facultatives : MAIL_FROM, META_PIXEL_ID, GRAPH_VERSION, FIRESTORE_BASE (tests), DEV (local uniquement)

const PIXEL_DEFAULT = '1671688320192246';
const GRAPH_DEFAULT = 'v23.0';
const FIRESTORE_DEFAULT = 'https://firestore.googleapis.com/v1/projects/dilam-boutique/databases/(default)/documents';
// Clé web Firebase : publique par nature (elle figurait dans l'ancien site). Utilisée uniquement pour la migration.
const FIREBASE_WEB_KEY = 'AIzaSyDyOrVT9Zb2s37unS2ailL05YqH0WDnlks';

const COLLECTIONS = new Set(['books', 'shop_config', 'stats', 'ventes']);
const PUBLIC_READ = new Set(['books', 'shop_config']);
const STAT_TYPES = new Set(['views', 'carts', 'orders']);
const PUBLIC_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead', 'Contact', 'Search']);
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const SESSION_TTL = 12 * 3600;      // 12 h
const CODE_TTL = 10 * 60;           // 10 min
const CODE_MAX_ATTEMPTS = 5;
const MAX_DOC_BYTES = 200 * 1024;
const MAX_IMG_BYTES = 10 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_.\-]{1,128}$/;

// ───────────────────────── utilitaires ─────────────────────────
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
function randHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return hex(a);
}
function sixDigits() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}
const err = (status, code) => json({ error: code }, status);
function clientIp(req) {
  return req.headers.get('CF-Connecting-IP') || '0.0.0.0';
}
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  for (const part of c.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
async function readJson(req, max = MAX_DOC_BYTES) {
  const len = parseInt(req.headers.get('Content-Length') || '0', 10);
  if (len > max) throw Object.assign(new Error('too_large'), { status: 413 });
  const txt = await req.text();
  if (txt.length > max) throw Object.assign(new Error('too_large'), { status: 413 });
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    throw Object.assign(new Error('bad_json'), { status: 400 });
  }
}
function maskEmail(e) {
  const [u, d] = String(e).split('@');
  return (u ? u[0] : '') + '•••@' + (d || '');
}

function withSecurityHeaders(res, req) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000');
  if (new URL(req.url).hostname.endsWith('.workers.dev')) h.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// ───────────────────────── limiteur ─────────────────────────
async function rateOk(env, key, limit, windowSec) {
  const w = Math.floor(now() / windowSec);
  const row = await env.DB.prepare(
    'INSERT INTO rl(k,n,exp) VALUES(?1,1,?2) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n'
  ).bind(`${key}:${w}`, (w + 1) * windowSec).first();
  return row.n <= limit;
}
function cleanup(env, ctx) {
  if (Math.random() < 0.02) {
    const t = now();
    ctx.waitUntil(
      env.DB.batch([
        env.DB.prepare('DELETE FROM rl WHERE exp < ?').bind(t),
        env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
        env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(t - 86400),
      ]).catch(() => {})
    );
  }
}

// ───────────────────────── session admin ─────────────────────────
async function isAdmin(req, env) {
  const t = getCookie(req, 'dsess');
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash=?')
    .bind(await sha256hex(t)).first();
  return !!row && row.expires_at > now();
}
function sessionCookie(token, maxAge) {
  return `dsess=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function sendMail(env, to, subject, text) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV === '1') {
      console.log(`[DEV] email à ${to} : ${subject} — ${text}`);
      return true;
    }
    return false;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Dilam B' <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!r.ok) console.error('resend', r.status, await r.text());
  return r.ok;
}

async function authRequest(req, env) {
  if (!env.ADMIN_EMAIL) return err(503, 'admin_email_missing');
  const ip = clientIp(req);
  if (!(await rateOk(env, 'auth-req:' + ip, 5, 3600)) || !(await rateOk(env, 'auth-req:all', 20, 3600))) {
    return err(429, 'too_many');
  }
  const code = sixDigits();
  const salt = randHex(16);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE login_codes SET used=1 WHERE used=0'),
    env.DB.prepare('INSERT INTO login_codes(code_hash,salt,created_at,expires_at) VALUES(?,?,?,?)')
      .bind(await sha256hex(code + ':' + salt), salt, t, t + CODE_TTL),
  ]);
  const ok = await sendMail(
    env,
    env.ADMIN_EMAIL,
    `Code de connexion Dilam B' : ${code}`,
    `Ton code de connexion à l'administration Dilam B' est : ${code}\n\nIl est valable 10 minutes et ne fonctionne qu'une fois.\nSi tu n'as rien demandé, ignore cet email : personne ne peut se connecter sans ce code.`
  );
  if (!ok) return err(502, 'mail_failed');
  return json({ ok: true, to: maskEmail(env.ADMIN_EMAIL) });
}

async function authVerify(req, env) {
  const ip = clientIp(req);
  if (!(await rateOk(env, 'auth-ver:' + ip, 10, 900))) return err(429, 'too_many');
  const body = await readJson(req, 1024);
  const code = String(body.code || '').replace(/\D/g, '');
  if (code.length !== 6) return err(400, 'bad_code');
  const row = await env.DB.prepare(
    'SELECT id,code_hash,salt,attempts FROM login_codes WHERE used=0 AND expires_at>? ORDER BY id DESC LIMIT 1'
  ).bind(now()).first();
  if (!row) return err(401, 'no_code');
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    await env.DB.prepare('UPDATE login_codes SET used=1 WHERE id=?').bind(row.id).run();
    return err(401, 'locked');
  }
  await env.DB.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE id=?').bind(row.id).run();
  if (!safeEqual(await sha256hex(code + ':' + row.salt), row.code_hash)) return err(401, 'wrong_code');

  const token = randHex(32);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE login_codes SET used=1 WHERE id=?').bind(row.id),
    env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)')
      .bind(await sha256hex(token), t, t + SESSION_TTL),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL) });
}

async function authLogout(req, env) {
  const t = getCookie(req, 'dsess');
  if (t && /^[0-9a-f]{64}$/.test(t)) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256hex(t)).run();
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

// ───────────────────────── documents ─────────────────────────
function rowToDoc(r) {
  let d = {};
  try { d = JSON.parse(r.data); } catch {}
  d._id = r.id;
  return d;
}
function cleanBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('bad_body'), { status: 400 });
  }
  const o = { ...body };
  delete o._id;
  return o;
}

async function dbRoute(req, env, col, id, admin) {
  if (!COLLECTIONS.has(col)) return err(404, 'unknown_collection');
  if (id !== null && !ID_RE.test(id)) return err(400, 'bad_id');
  const m = req.method;

  if (m === 'GET') {
    if (!PUBLIC_READ.has(col) && !admin) return err(401, 'auth');
    if (id === null) {
      const { results } = await env.DB.prepare('SELECT id,data FROM docs WHERE col=? ORDER BY rowid').bind(col).all();
      return json(results.map(rowToDoc));
    }
    const r = await env.DB.prepare('SELECT id,data FROM docs WHERE col=? AND id=?').bind(col, id).first();
    return r ? json(rowToDoc(r)) : err(404, 'not_found');
  }

  if (!admin) return err(401, 'auth');

  if (m === 'POST' && id === null) {
    const body = cleanBody(await readJson(req));
    const newId = randHex(10);
    await env.DB.prepare('INSERT INTO docs(col,id,data,updated_at) VALUES(?,?,?,?)')
      .bind(col, newId, JSON.stringify(body), now()).run();
    return json({ ...body, _id: newId }, 201);
  }
  if (m === 'PUT' && id !== null) {
    // Fusion : seuls les champs envoyés sont modifiés (corrige l'ancien comportement Firebase
    // qui remplaçait tout le document, par exemple lors du tri).
    const body = cleanBody(await readJson(req));
    const r = await env.DB.prepare('SELECT data FROM docs WHERE col=? AND id=?').bind(col, id).first();
    let cur = {};
    if (r) { try { cur = JSON.parse(r.data); } catch {} }
    const merged = { ...cur, ...body };
    const s = JSON.stringify(merged);
    if (s.length > MAX_DOC_BYTES) return err(413, 'too_large');
    await env.DB.prepare(
      'INSERT INTO docs(col,id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at'
    ).bind(col, id, s, now()).run();
    return json({ ...merged, _id: id });
  }
  if (m === 'DELETE' && id !== null) {
    await env.DB.prepare('DELETE FROM docs WHERE col=? AND id=?').bind(col, id).run();
    return json({ ok: true });
  }
  return err(405, 'method');
}

// Compteurs publics : uniquement +1, jamais d'écriture libre.
async function statsHit(req, env) {
  if (!(await rateOk(env, 'stat:' + clientIp(req), 600, 3600))) return json({ ok: false }, 429);
  const body = await readJson(req, 512);
  const type = String(body.type || '');
  const bid = String(body.book_id ?? '');
  // Les livres sont identifiés par leur position (1 à 9999) : on refuse tout le reste.
  if (!STAT_TYPES.has(type) || !/^\d{1,4}$/.test(bid)) return err(400, 'bad_stat');
  const t = now();
  const path = '$.' + type; // type validé par liste blanche
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO docs(col,id,data,updated_at) VALUES('stats',?1,json_object('book_id',?2,'views',0,'carts',0,'orders',0),?3) ON CONFLICT(col,id) DO NOTHING"
    ).bind(bid, Number(bid), t),
    env.DB.prepare(
      "UPDATE docs SET data=json_set(data,?1,COALESCE(json_extract(data,?1),0)+1), updated_at=?2 WHERE col='stats' AND id=?3"
    ).bind(path, t, bid),
  ]);
  return json({ ok: true });
}

// ───────────────────────── images ─────────────────────────
async function uploadImage(req, env) {
  const ct = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const ext = IMG_TYPES[ct];
  if (!ext) return err(415, 'bad_type');
  const len = parseInt(req.headers.get('Content-Length') || '0', 10);
  if (len > MAX_IMG_BYTES) return err(413, 'too_large');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_IMG_BYTES) return err(413, 'too_large');
  const key = `img/${Date.now()}-${randHex(4)}.${ext}`;
  await env.FILES.put(key, buf, { metadata: { ct } });
  return json({ url: '/media/' + key }, 201);
}

async function serveMedia(path, env) {
  const key = path.slice('/media/'.length);
  // Seules les images sont publiques. Les PDF (préfixe pdf/) ne sortent jamais par ici.
  if (!/^img\/[0-9]+-[0-9a-f]{8}\.(jpg|png|webp|gif)$/.test(key)) return err(404, 'not_found');
  const { value, metadata } = await env.FILES.getWithMetadata(key, { type: 'stream' });
  if (!value) return err(404, 'not_found');
  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.ct) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ───────────────────────── Meta CAPI ─────────────────────────
async function sendToMeta(env, events) {
  const pixel = env.META_PIXEL_ID || PIXEL_DEFAULT;
  const ver = env.GRAPH_VERSION || GRAPH_DEFAULT;
  return fetch(`https://graph.facebook.com/${ver}/${pixel}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: events }),
  });
}

async function capiPublic(req, env, ctx) {
  if (!env.META_CAPI_TOKEN) return json({ ok: false, reason: 'not_configured' }, 202);
  if (!(await rateOk(env, 'capi:' + clientIp(req), 300, 3600))) return json({ ok: false }, 429);
  const b = await readJson(req, 4096);
  const name = String(b.event_name || '');
  if (!PUBLIC_EVENTS.has(name)) return err(400, 'event_not_allowed');
  const ud = { client_ip_address: clientIp(req), client_user_agent: req.headers.get('User-Agent') || '' };
  if (typeof b.fbp === 'string' && b.fbp.length < 200) ud.fbp = b.fbp;
  if (typeof b.fbc === 'string' && b.fbc.length < 400) ud.fbc = b.fbc;
  const ev = {
    event_name: name,
    event_time: now(),
    event_id: String(b.event_id || 'evt_' + randHex(6)).slice(0, 100),
    action_source: 'website',
    event_source_url: String(b.event_source_url || '').slice(0, 500),
    user_data: ud,
    custom_data: b.custom_data && typeof b.custom_data === 'object' ? b.custom_data : {},
  };
  ctx.waitUntil(sendToMeta(env, [ev]).then(async (r) => { if (!r.ok) console.error('capi', r.status, await r.text()); }).catch(() => {}));
  return json({ ok: true }, 202);
}

async function capiAdmin(req, env) {
  if (!env.META_CAPI_TOKEN) return err(503, 'capi_not_configured');
  const b = await readJson(req, 100 * 1024);
  if (!Array.isArray(b.data) || !b.data.length || b.data.length > 50) return err(400, 'bad_events');
  const r = await sendToMeta(env, b.data);
  return new Response(await r.text(), {
    status: r.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// ───────────────────────── migration Firebase → D1 ─────────────────────────
function fsParse(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsParse);
  if ('mapValue' in v) {
    const o = {};
    for (const k of Object.keys(v.mapValue.fields || {})) o[k] = fsParse(v.mapValue.fields[k]);
    return o;
  }
  return null;
}
async function migrate(req, env) {
  const { col } = await readJson(req, 512);
  if (!COLLECTIONS.has(col)) return err(400, 'bad_collection');
  const base = env.FIRESTORE_BASE || FIRESTORE_DEFAULT;
  const rows = [];
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const u = `${base}/${col}?pageSize=300&key=${FIREBASE_WEB_KEY}${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
    const r = await fetch(u);
    if (!r.ok) return json({ error: 'firestore', status: r.status }, 502);
    const d = await r.json();
    for (const doc of d.documents || []) {
      const id = doc.name.split('/').pop();
      if (!ID_RE.test(id)) continue;
      const o = {};
      for (const k of Object.keys(doc.fields || {})) o[k] = fsParse(doc.fields[k]);
      // Les images du dépôt deviennent des chemins relatifs : elles suivent le site quel que soit le domaine.
      const s = JSON.stringify(o).replace(/https?:\/\/(www\.)?dilamboutique\.com\/public\//g, '/public/');
      rows.push([id, s]);
    }
    pageToken = d.nextPageToken || '';
    if (!pageToken) break;
  }
  const t = now();
  const stmts = rows.map(([id, s]) =>
    env.DB.prepare(
      'INSERT INTO docs(col,id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at'
    ).bind(col, id, s, t)
  );
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  return json({ ok: true, col, count: rows.length });
}

// ───────────────────────── routeur ─────────────────────────
async function api(req, env, ctx, url) {
  const p = url.pathname;
  const m = req.method;

  // Toute écriture doit venir du site lui-même (protection CSRF) :
  // en-tête personnalisé obligatoire + origine identique si le navigateur l'annonce.
  if (m !== 'GET' && m !== 'HEAD') {
    if (req.headers.get('X-Dilam') !== '1') return err(403, 'forbidden');
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return err(403, 'bad_origin');
  }

  if (p === '/api/auth/request' && m === 'POST') return authRequest(req, env);
  if (p === '/api/auth/verify' && m === 'POST') return authVerify(req, env);
  if (p === '/api/auth/logout' && m === 'POST') return authLogout(req, env);
  if (p === '/api/auth/me' && m === 'GET') return json({ admin: await isAdmin(req, env) });

  if (p === '/api/stats/hit' && m === 'POST') return statsHit(req, env);
  if (p === '/api/capi' && m === 'POST') return capiPublic(req, env, ctx);

  const dbm = p.match(/^\/api\/db\/([a-z_]+)(?:\/([^/]+))?$/);
  if (dbm) {
    let id = null;
    if (dbm[2] !== undefined) {
      try { id = decodeURIComponent(dbm[2]); } catch { return err(400, 'bad_id'); }
    }
    const needAdmin = m !== 'GET' || !PUBLIC_READ.has(dbm[1]);
    const admin = needAdmin ? await isAdmin(req, env) : false;
    return dbRoute(req, env, dbm[1], id, admin);
  }

  if (p.startsWith('/api/admin/')) {
    if (!(await isAdmin(req, env))) return err(401, 'auth');
    if (p === '/api/admin/upload' && m === 'POST') return uploadImage(req, env);
    if (p === '/api/admin/capi' && m === 'POST') return capiAdmin(req, env);
    if (p === '/api/admin/migrate' && m === 'POST') return migrate(req, env);
  }
  return err(404, 'not_found');
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    let res;
    try {
      if (url.pathname.startsWith('/api/')) {
        cleanup(env, ctx);
        res = await api(req, env, ctx, url);
      } else if (url.pathname.startsWith('/media/')) {
        res = await serveMedia(url.pathname, env);
      } else {
        res = await env.ASSETS.fetch(req);
      }
    } catch (e) {
      if (e && e.status) res = err(e.status, e.message);
      else {
        console.error(e && e.stack ? e.stack : e);
        res = err(500, 'server');
      }
    }
    return withSecurityHeaders(res, req);
  },
};
