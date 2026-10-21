// Dilam B' — serveur Cloudflare (Worker)
// Rôle : seul point d'accès aux données. Le navigateur ne détient aucun secret.
//
// Secrets (saisis par le propriétaire dans le tableau de bord Cloudflare, jamais dans ce code) :
//   ADMIN_EMAIL      adresse qui reçoit les codes de connexion admin
//   RESEND_API_KEY   clé d'envoi d'emails (Resend)
//   META_CAPI_TOKEN  jeton Meta Conversions API
//   ADMIN_PIN        code PIN personnel exigé en plus du code email
// Variables facultatives : MAIL_FROM, META_PIXEL_ID, GRAPH_VERSION, FIRESTORE_BASE (tests), DEV (local uniquement)

import { indexPdf, stampTail } from './watermark.js';

const PIXEL_DEFAULT = '1671688320192246';
const GRAPH_DEFAULT = 'v23.0';
const FIRESTORE_DEFAULT = 'https://firestore.googleapis.com/v1/projects/dilam-boutique/databases/(default)/documents';
// Clé web Firebase : publique par nature (elle figurait dans l'ancien site). Utilisée uniquement pour la migration.
const FIREBASE_WEB_KEY = 'AIzaSyDyOrVT9Zb2s37unS2ailL05YqH0WDnlks';

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://www.facebook.com https://connect.facebook.net; frame-src https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";
const COLLECTIONS = new Set(['books', 'shop_config', 'stats', 'ventes', 'ebooks']);
const PUBLIC_READ = new Set(['books', 'shop_config', 'ebooks']);
const STAT_TYPES = new Set(['views', 'carts', 'orders']);
const PUBLIC_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead', 'Contact', 'Search']);
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const SESSION_TTL = 12 * 3600;      // 12 h
const CODE_TTL = 10 * 60;           // 10 min
const DEVICE_TTL = 60 * 86400;      // appareil reconnu : 60 jours, renouvelés à chaque connexion
const DEVICE_MAX_FAILS = 5;         // au-delà, l'appareil est oublié et l'e-mail redevient obligatoire
const CODE_MAX_ATTEMPTS = 5;
const MAX_DOC_BYTES = 200 * 1024;
const MAX_IMG_BYTES = 10 * 1024 * 1024;
const MAX_VID_BYTES = 20 * 1024 * 1024; // une valeur KV plafonne à 25 Mio
const VID_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
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
  if ((h.get('Content-Type') || '').includes('text/html')) h.set('Content-Security-Policy', CSP);
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
        env.DB.prepare('DELETE FROM devices WHERE expires_at < ?').bind(t),
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

// Expéditeurs : le domaine dilamboutique.com est vérifié chez Resend.
const MAIL_SHOP = "Dilam B' <boutique@dilamboutique.com>";
const MAIL_AUTHOR = 'Lamine Diabaté <livraison@dilamboutique.com>';

async function sendMail(env, to, subject, text, from) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV === '1') {
      console.log(`[DEV] email à ${to} : ${subject} — ${text}`);
      return true;
    }
    return false;
  }
  const payload = { from: from || env.MAIL_FROM || MAIL_SHOP, to: [to], subject, text };
  // Les réponses des clients arrivent dans ta boîte Gmail.
  if (env.ADMIN_EMAIL && to !== env.ADMIN_EMAIL) payload.reply_to = env.ADMIN_EMAIL;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const codeOk = safeEqual(await sha256hex(code + ':' + row.salt), row.code_hash);
  // Deuxième facteur : code PIN personnel (secret ADMIN_PIN). On compare des empreintes de même longueur.
  let pinOk = true;
  if (env.ADMIN_PIN) {
    const pin = String(body.pin || '');
    pinOk = safeEqual(await sha256hex('pin:' + pin), await sha256hex('pin:' + String(env.ADMIN_PIN)));
  }
  // Message identique dans tous les cas : on ne dit jamais lequel des deux est faux.
  if (!codeOk || !pinOk) return err(401, 'wrong_code');

  const token = randHex(32);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE login_codes SET used=1 WHERE id=?').bind(row.id),
    env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)')
      .bind(await sha256hex(token), t, t + SESSION_TTL),
  ]);
  const res = json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL) });
  // L'appareil est reconnu : les prochaines fois, le code PIN suffit.
  if (env.ADMIN_PIN) {
    const dev = randHex(32);
    await env.DB.prepare('INSERT INTO devices(token_hash,created_at,last_used,expires_at,fails) VALUES(?,?,?,?,0)')
      .bind(await sha256hex(dev), t, t, t + DEVICE_TTL).run();
    res.headers.append('Set-Cookie', deviceCookie(dev, DEVICE_TTL));
  }
  return res;
}

// ───────────────────────── appareil reconnu ─────────────────────────
// Le jeton d'appareil n'est envoyé qu'aux adresses /api/auth/ ; on ne garde que son empreinte.
function deviceCookie(token, maxAge) {
  return `ddev=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${maxAge}`;
}
async function getDevice(req, env) {
  const t = getCookie(req, 'ddev');
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;
  const h = await sha256hex(t);
  const row = await env.DB.prepare('SELECT token_hash,expires_at,fails FROM devices WHERE token_hash=?').bind(h).first();
  return row && row.expires_at > now() ? { hash: h, token: t, fails: row.fails } : null;
}
async function authPin(req, env) {
  const ip = clientIp(req);
  if (!(await rateOk(env, 'auth-pin:' + ip, 10, 900))) return err(429, 'too_many');
  if (!env.ADMIN_PIN) return err(400, 'pin_missing');
  const dev = await getDevice(req, env);
  if (!dev) return err(401, 'no_device');
  const body = await readJson(req, 1024);
  const ok = safeEqual(await sha256hex('pin:' + String(body.pin || '')), await sha256hex('pin:' + String(env.ADMIN_PIN)));
  if (!ok) {
    if (dev.fails + 1 >= DEVICE_MAX_FAILS) {
      await env.DB.prepare('DELETE FROM devices WHERE token_hash=?').bind(dev.hash).run();
      return json({ error: 'device_reset' }, 401, { 'Set-Cookie': deviceCookie('', 0) });
    }
    await env.DB.prepare('UPDATE devices SET fails=fails+1 WHERE token_hash=?').bind(dev.hash).run();
    return err(401, 'wrong_pin');
  }
  const token = randHex(32);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE devices SET fails=0, last_used=?, expires_at=? WHERE token_hash=?').bind(t, t + DEVICE_TTL, dev.hash),
    env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)')
      .bind(await sha256hex(token), t, t + SESSION_TTL),
  ]);
  const res = json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL) });
  res.headers.append('Set-Cookie', deviceCookie(dev.token, DEVICE_TTL));
  return res;
}
async function authForget(req, env) {
  const dev = await getDevice(req, env);
  if (dev) await env.DB.prepare('DELETE FROM devices WHERE token_hash=?').bind(dev.hash).run();
  const t = getCookie(req, 'dsess');
  if (t && /^[0-9a-f]{64}$/.test(t)) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256hex(t)).run();
  }
  const res = json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  res.headers.append('Set-Cookie', deviceCookie('', 0));
  return res;
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

// Vidéos courtes des pages de vente (MP4 ou WebM, 20 Mo au plus).
async function uploadVideo(req, env) {
  const ct = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const ext = VID_TYPES[ct];
  if (!ext) return err(415, 'bad_type');
  const len = parseInt(req.headers.get('Content-Length') || '0', 10);
  if (len > MAX_VID_BYTES) return err(413, 'too_large');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_VID_BYTES) return err(413, 'too_large');
  const b = new Uint8Array(buf.slice(0, 12));
  const isMp4 = String.fromCharCode(b[4], b[5], b[6], b[7]) === 'ftyp';
  const isWebm = b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  if ((ext === 'mp4' && !isMp4) || (ext === 'webm' && !isWebm)) return err(415, 'not_video');
  const key = `vid/${Date.now()}-${randHex(4)}.${ext}`;
  await env.FILES.put(key, buf, { metadata: { ct, size: buf.byteLength } });
  return json({ url: '/media/' + key, size: buf.byteLength }, 201);
}
async function deleteVideo(env, url) {
  const key = (url.searchParams.get('url') || '').replace(/^\/media\//, '');
  if (!/^vid\/[0-9]+-[0-9a-f]{8}\.(mp4|webm)$/.test(key)) return err(400, 'bad_key');
  await env.FILES.delete(key);
  return json({ ok: true });
}

async function serveMedia(req, path, env) {
  const key = path.slice('/media/'.length);
  // Seules les images et les vidéos des pages de vente sont publiques. Les PDF (préfixe pdf/) ne sortent jamais par ici.
  const isImg = /^img\/[0-9]+-[0-9a-f]{8}\.(jpg|png|webp|gif)$/.test(key);
  const isVid = /^vid\/[0-9]+-[0-9a-f]{8}\.(mp4|webm)$/.test(key);
  if (!isImg && !isVid) return err(404, 'not_found');
  const cache = 'public, max-age=31536000, immutable';
  if (isImg) {
    const { value, metadata } = await env.FILES.getWithMetadata(key, { type: 'stream' });
    if (!value) return err(404, 'not_found');
    return new Response(value, { headers: { 'Content-Type': (metadata && metadata.ct) || 'application/octet-stream', 'Cache-Control': cache } });
  }
  // Vidéo : les lecteurs (Safari en particulier) demandent le fichier par morceaux (en-tête Range).
  const { value, metadata } = await env.FILES.getWithMetadata(key, { type: 'arrayBuffer', cacheTtl: 3600 });
  if (!value) return err(404, 'not_found');
  const total = value.byteLength;
  const h = { 'Content-Type': (metadata && metadata.ct) || 'video/mp4', 'Cache-Control': cache, 'Accept-Ranges': 'bytes' };
  const range = req.headers.get('Range');
  const m = range && range.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start, end;
    if (m[1]) { start = parseInt(m[1], 10); end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1; }
    else { start = Math.max(0, total - parseInt(m[2], 10)); end = total - 1; }
    if (start >= total || start > end) return new Response(null, { status: 416, headers: { ...h, 'Content-Range': `bytes */${total}` } });
    return new Response(req.method === 'HEAD' ? null : value.slice(start, end + 1), {
      status: 206,
      headers: { ...h, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(req.method === 'HEAD' ? null : value, { headers: { ...h, 'Content-Length': String(total) } });
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

// ───────────────────────── aperçus de partage (WhatsApp, Facebook, Google) ─────────────────────────
// Une page livre partagée affiche son titre, son prix et sa couverture dans l'aperçu.
async function bookPage(req, env, url) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/', url.origin), req));
  const slug = url.searchParams.get('livre').slice(0, 120);
  let row = null;
  try {
    row = await env.DB.prepare(
      "SELECT data FROM docs WHERE col='books' AND (json_extract(data,'$.slug')=?1 OR id=?1) LIMIT 1"
    ).bind(slug).first();
  } catch {}
  if (!row) return asset;
  let b = {};
  try { b = JSON.parse(row.data); } catch { return asset; }
  const price = (parseInt(b.price, 10) || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const title = `${b.title || 'Livre'} | ${price} F | Dilam B'`;
  const desc = plainText(b.description).slice(0, 180) ||
    `${b.title} : paiement à la livraison, livraison en 24 h à Abidjan.`;
  const img = b.image ? new URL(encodeURI(decodeURISafe(b.image)), url.origin).href : url.origin + '/public/images/logo.png';
  const set = (sel, val) => ({ element(el) { el.setAttribute('content', val); } });
  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set('', desc))
    .on('meta[property="og:title"]', set('', title))
    .on('meta[property="og:description"]', set('', desc))
    .on('meta[property="og:image"]', set('', img))
    .on('head', {
      element(el) {
        const canon = `${url.origin}/?livre=${encodeURIComponent(b.slug || slug)}`;
        const ld = {
          '@context': 'https://schema.org', '@type': ['Book', 'Product'],
          name: b.title, image: [img], description: desc, sku: b.slug || slug, url: canon,
          ...(b.author ? { author: { '@type': 'Person', name: b.author } } : {}),
          offers: {
            '@type': 'Offer', price: parseInt(b.price, 10) || 0, priceCurrency: 'XOF', url: canon,
            availability: b.out_of_stock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: "Dilam B'" },
          },
        };
        el.append(`<link rel="canonical" href="${canon}">` + jsonLd(ld), { html: true });
      },
    })
    .transform(asset);
}

// Données structurées : Google peut afficher le prix et la disponibilité dans ses résultats.
function jsonLd(o) { return `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`; }
function plainText(t) { return String(t || '').replace(/\*\*/g, '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim(); }

// Accueil : image de partage en adresse complète, données de la boutique.
async function homePage(req, env, url) {
  const asset = await env.ASSETS.fetch(req);
  if (url.search) return asset; // catalogue, catégories : rendus par le navigateur
  const logo = url.origin + '/public/images/logo.png';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: "Dilam B'", url: url.origin + '/', logo,
      address: { '@type': 'PostalAddress', addressLocality: 'Abidjan', addressCountry: 'CI' } },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: "Dilam B'", url: url.origin + '/', inLanguage: 'fr' },
  ];
  return new HTMLRewriter()
    .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', logo); } })
    .on('head', { element(el) { el.append(`<link rel="canonical" href="${url.origin}/"><meta property="og:url" content="${url.origin}/">` + jsonLd(ld), { html: true }); } })
    .transform(asset);
}

// Plan du site pour les moteurs de recherche.
async function sitemap(env, url) {
  const o = url.origin;
  const ts = (t) => { const n = Number(t) || 0; const d = new Date(n > 1e12 ? n : n * 1000); return isNaN(d) || !n ? '' : `<lastmod>${d.toISOString().slice(0, 10)}</lastmod>`; };
  const u = (loc, t) => `<url><loc>${escH(loc)}</loc>${ts(t)}</url>`;
  const { results: books } = await env.DB.prepare("SELECT id, json_extract(data,'$.slug') slug, json_extract(data,'$.category') cat, updated_at t FROM docs WHERE col='books'").all();
  const { results: ebooks } = await env.DB.prepare("SELECT id, updated_at t FROM docs WHERE col='ebooks' AND COALESCE(json_extract(data,'$.hidden'),0)=0 AND COALESCE(json_extract(data,'$.active'),1)=1").all();
  const cats = [...new Set(books.map((b) => b.cat).filter(Boolean))];
  const lines = [u(o + '/'), u(o + '/?vue=livres'), ...cats.map((c) => u(`${o}/?cat=${encodeURIComponent(c)}`)),
    ...ebooks.map((e) => u(`${o}/ebook/${e.id}`, e.t)),
    ...books.map((b) => u(`${o}/?livre=${encodeURIComponent(b.slug || b.id)}`, b.t)),
    u(o + '/conditions'), u(o + '/confidentialite')];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${lines.join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
// Pages de vente des ebooks : /ebook/<adresse>
async function ebookPage(req, env, url) {
  const slug = url.pathname.split('/')[2];
  const asset = await env.ASSETS.fetch(new Request(new URL('/ebook', url.origin), req));
  let e = null;
  try {
    const row = await env.DB.prepare("SELECT data FROM docs WHERE col='ebooks' AND id=?").bind(slug).first();
    if (row) e = JSON.parse(row.data);
  } catch {}
  if (!e || e.active === false) {
    const r = dlPage('Page introuvable', '<h1>Cette page n’existe pas ou n’est plus en ligne.</h1><p><a class="btn btn-primary" href="/">Retour à la boutique</a></p>');
    return new Response(r.body, { status: 404, headers: r.headers });
  }
  if (e.mode === 'html') return ebookHtmlPage(env, url, slug, e);
  const seo = e.seo || {};
  const title = seo.title || e.title || "Dilam B'";
  const desc = seo.description || e.subtitle || '';
  const img = e.cover ? new URL(e.cover, url.origin).href : url.origin + '/public/images/logo.png';
  // Aperçu WhatsApp et Facebook : la bannière si elle existe, plus parlante que la couverture seule.
  const share = e.banner ? new URL(e.banner, url.origin).href : img;
  const set = (val) => ({ element(el) { el.setAttribute('content', val); } });
  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:image"]', set(share))
    .on('head', {
      element(el) {
        const canon = `${url.origin}/ebook/${slug}`;
        const ld = {
          '@context': 'https://schema.org', '@type': ['Book', 'Product'], name: e.title, image: [img], description: desc, sku: slug, url: canon,
          bookFormat: 'https://schema.org/EBook', inLanguage: 'fr', author: { '@type': 'Person', name: e.author_name || 'Lamine Diabaté' },
          offers: { '@type': 'Offer', price: parseInt(e.price, 10) || 0, priceCurrency: 'XOF', availability: 'https://schema.org/InStock', url: canon },
        };
        el.append(`<link rel="canonical" href="${canon}">` + (e.hidden ? '<meta name="robots" content="noindex, nofollow">' : jsonLd(ld)), { html: true });
      },
    })
    // Contenu injecté dans la page : un aller-retour réseau de moins au chargement.
    .on('body', { element(el) { el.append(`<script type="application/json" id="ebdata">${JSON.stringify({ ...e, slug }).replace(/</g, '\\u003c')}</script>`, { html: true }); } })
    .transform(asset);
}

// ───────────────────────── paiement des ebooks (Paystack) ─────────────────────────
const PAYSTACK_DEFAULT = 'https://api.paystack.co';
const DL_HOURS = 24;          // durée de validité du lien de téléchargement
const DL_PER_FILE = 2;        // téléchargements autorisés par fichier (le 2e n'est proposé qu'en cas d'échec)
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const WA_DEFAULT = '2250546494484';

async function hmacHex(alg, key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: alg }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
// Signature du lien de téléchargement : rien à stocker, impossible à deviner sans la clé.
async function dlSig(env, ref) {
  return (await hmacHex('SHA-256', (env.DL_SECRET || env.PAYSTACK_SECRET_KEY) + ':dl', ref)).slice(0, 32);
}
async function dlLink(env, origin, ref) {
  return `${origin}/telecharger/${ref}/${await dlSig(env, ref)}`;
}
async function getEbook(env, slug) {
  const row = await env.DB.prepare("SELECT data FROM docs WHERE col='ebooks' AND id=?").bind(slug).first();
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}
async function waNumberOf(env) {
  try {
    const row = await env.DB.prepare("SELECT data FROM docs WHERE col='shop_config' AND id='sell_config'").first();
    const n = row && JSON.parse(row.data).value.waNumber;
    if (n) return String(n).replace(/[^0-9]/g, '');
  } catch {}
  return WA_DEFAULT;
}
function fcfa(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'; }

async function checkout(req, env) {
  if (!(await rateOk(env, 'checkout:' + clientIp(req), 20, 3600))) return err(429, 'too_many');
  const b = await readJson(req, 2048);
  const slug = String(b.slug || '');
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return err(400, 'bad_product');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) || email.length > 200) return err(400, 'bad_email');
  const e = await getEbook(env, slug);
  if (!e || e.active === false) return err(404, 'not_found');
  const price = parseInt(e.price, 10);
  if (!(price > 0)) return err(400, 'bad_price');
  if (!env.PAYSTACK_SECRET_KEY) return err(503, 'payment_not_ready');

  const origin = new URL(req.url).origin;
  const ref = 'LDL-' + Date.now().toString(36).toUpperCase() + '-' + randHex(5).toUpperCase();
  const meta = {
    fbp: typeof b.fbp === 'string' ? b.fbp.slice(0, 200) : '',
    fbc: typeof b.fbc === 'string' ? b.fbc.slice(0, 400) : '',
    ua: (req.headers.get('User-Agent') || '').slice(0, 300),
    ip: clientIp(req),
    url: origin + '/ebook/' + slug,
  };
  await env.DB.prepare('INSERT INTO orders(reference,slug,email,amount,created_at,meta) VALUES(?,?,?,?,?,?)')
    .bind(ref, slug, email, price, now(), JSON.stringify(meta)).run();

  const r = await fetch((env.PAYSTACK_BASE || PAYSTACK_DEFAULT) + '/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount: String(price * 100), // XOF : Paystack demande le montant multiplié par 100
      currency: 'XOF',
      reference: ref,
      callback_url: origin + '/merci',
      channels: ['mobile_money', 'card'],
      metadata: JSON.stringify({ slug, produit: e.title }),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.status || !j.data || !j.data.authorization_url) {
    console.error('paystack init', r.status, JSON.stringify(j).slice(0, 300));
    return err(502, 'payment_error');
  }
  return json({ url: j.data.authorization_url, reference: ref });
}

// Vérifie le paiement auprès de Paystack, puis livre une seule fois (e-mail + événement Purchase).
async function fulfill(env, ctx, ref, origin) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE reference=?').bind(ref).first();
  if (!o || o.status !== 'pending' || !env.PAYSTACK_SECRET_KEY) return o;
  const r = await fetch((env.PAYSTACK_BASE || PAYSTACK_DEFAULT) + '/transaction/verify/' + encodeURIComponent(ref), {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const j = await r.json().catch(() => ({}));
  const d = j && j.data;
  if (!r.ok || !j.status || !d || d.status !== 'success') return o;
  if (d.currency !== 'XOF' || Number(d.amount) !== o.amount * 100 || d.reference !== ref) {
    console.error('paystack mismatch', ref, d.currency, d.amount);
    await env.DB.prepare("UPDATE orders SET status='mismatch' WHERE reference=? AND status='pending'").bind(ref).run();
    return { ...o, status: 'mismatch' };
  }
  const t = now();
  const upd = await env.DB.prepare("UPDATE orders SET status='paid', paid_at=?, channel=? WHERE reference=? AND status='pending'")
    .bind(t, String(d.channel || ''), ref).run();
  const paid = { ...o, status: 'paid', paid_at: t, channel: d.channel };
  if (upd.meta.changes !== 1) return paid; // déjà livré par un autre appel

  const e = (await getEbook(env, o.slug)) || { title: o.slug, files: { items: [] } };
  const link = await dlLink(env, origin, ref);
  const wa = await waNumberOf(env);
  const files = ((e.files && e.files.items) || []).map((f) => `- ${f.name}${f.pages ? ` (${f.pages} pages)` : ''}`).join('\n');
  const body =
`Bonjour,

Merci pour ton achat. Voici ton lien de téléchargement personnel :
${link}

Il est valable ${DL_HOURS} heures et chaque fichier se télécharge une seule fois : enregistre-les sur ton téléphone dès maintenant.

Ce que tu reçois :
${files}

Pour remplir le Workbook directement dans le PDF, ouvre-le avec Adobe Acrobat Reader (gratuit sur Android et iPhone).

Un souci avec tes fichiers ? Écris-moi sur WhatsApp en indiquant cette adresse e-mail : https://wa.me/${wa}

Lamine Diabaté
Référence de commande : ${ref}`;
  const ok = await sendMail(env, o.email, `Tes fichiers : ${e.title}`, body, MAIL_AUTHOR);
  if (ok) await env.DB.prepare('UPDATE orders SET mailed=1 WHERE reference=?').bind(ref).run();
  paid.mailed = ok ? 1 : 0;
  if (env.ADMIN_EMAIL) {
    ctx.waitUntil(sendMail(env, env.ADMIN_EMAIL, `Nouvelle vente : ${e.title} (${fcfa(o.amount)})`,
      `${e.title}\n${fcfa(o.amount)} par ${d.channel || 'paiement en ligne'}\nAcheteur : ${o.email}\nRéférence : ${ref}\nE-mail de livraison : ${ok ? 'envoyé' : 'ÉCHEC, à renvoyer'}`).catch(() => {}));
  }
  if (env.META_CAPI_TOKEN) {
    let m = {};
    try { m = JSON.parse(o.meta || '{}'); } catch {}
    const ud = { em: [await sha256hex(o.email)], client_ip_address: m.ip || undefined, client_user_agent: m.ua || undefined };
    if (m.fbp) ud.fbp = m.fbp;
    if (m.fbc) ud.fbc = m.fbc;
    ctx.waitUntil(sendToMeta(env, [{
      event_name: 'Purchase', event_time: t, event_id: ref, action_source: 'website',
      event_source_url: m.url || origin, user_data: ud,
      custom_data: { value: o.amount, currency: 'XOF', content_ids: [o.slug], content_type: 'product', content_name: e.title },
    }]).catch(() => {}));
  }
  return paid;
}

async function paystackWebhook(req, env, ctx) {
  if (!env.PAYSTACK_SECRET_KEY) return err(503, 'not_ready');
  const raw = await req.text();
  if (raw.length > 64 * 1024) return err(413, 'too_large');
  const sig = req.headers.get('x-paystack-signature') || '';
  const expected = await hmacHex('SHA-512', env.PAYSTACK_SECRET_KEY, raw);
  if (!safeEqual(sig, expected)) return err(401, 'bad_signature');
  let ev = {};
  try { ev = JSON.parse(raw); } catch { return err(400, 'bad_body'); }
  if (ev.event === 'charge.success' && ev.data && typeof ev.data.reference === 'string') {
    await fulfill(env, ctx, ev.data.reference, new URL(req.url).origin);
  }
  return json({ ok: true });
}

// Page « merci » : l'acheteur revient de Paystack et attend la confirmation.
async function orderStatus(req, env, ctx, url) {
  if (!(await rateOk(env, 'order:' + clientIp(req), 120, 3600))) return err(429, 'too_many');
  const ref = url.searchParams.get('ref') || '';
  if (!/^LDL-[A-Z0-9-]{6,40}$/.test(ref)) return err(400, 'bad_ref');
  const o = await fulfill(env, ctx, ref, url.origin);
  if (!o) return err(404, 'not_found');
  const e = await getEbook(env, o.slug);
  const out = { status: o.status, email: maskEmail(o.email), title: e ? e.title : o.slug, amount: o.amount, slug: o.slug };
  if (o.status === 'paid') {
    out.download = await dlLink(env, url.origin, ref);
    out.mailed = !!o.mailed;
  }
  return json(out);
}

// ───────────────────────── téléchargement ─────────────────────────
function dlPage(title, inner) {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Lamine Diabaté</title><link rel="stylesheet" href="/assets/app.css"><link rel="stylesheet" href="/assets/ebook.css"></head><body class="ebook-page"><header class="eb-top"><div class="eb-top-in"><a class="brand-name" href="/">Dilam B'</a><a class="eb-home" href="/">Retour à la boutique</a></div></header><main class="dl-page">${inner}</main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
// Nom de fichier sans accents ni espaces, pour les téléphones qui ignorent le nom complet.
function asciiName(n) {
  return String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9.]+/g, '-').replace(/-+/g, '-').replace(/^-|-(?=\.pdf$)/g, '').slice(0, 120) || 'fichier.pdf';
}
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function download(req, env, ctx, url) {
  const m = url.pathname.match(/^\/telecharger\/(LDL-[A-Z0-9-]{6,40})\/([0-9a-f]{32})(?:\/([0-9]{1,2}))?\/?$/);
  if (!m) return dlPage('Lien invalide', '<h1>Ce lien n’est pas valide.</h1><p>Vérifie que tu as copié le lien en entier depuis ton e-mail.</p>');
  const [, ref, sig, idxStr] = m;
  if (!env.PAYSTACK_SECRET_KEY || !safeEqual(sig, await dlSig(env, ref))) {
    return dlPage('Lien invalide', '<h1>Ce lien n’est pas valide.</h1><p>Vérifie que tu as copié le lien en entier depuis ton e-mail.</p>');
  }
  const o = await env.DB.prepare('SELECT * FROM orders WHERE reference=?').bind(ref).first();
  const wa = await waNumberOf(env);
  const help = `<p>Écris-moi sur WhatsApp avec l’adresse e-mail utilisée pour l’achat, je te renvoie tes fichiers.</p><p><a class="btn btn-primary" href="https://wa.me/${wa}?text=${encodeURIComponent('Bonjour, j’ai besoin d’aide pour télécharger mes fichiers. Référence : ' + ref)}">Écrire sur WhatsApp</a></p>`;
  if (!o || o.status !== 'paid') return dlPage('Paiement non confirmé', '<h1>Ce paiement n’est pas encore confirmé.</h1>' + help);
  const e = (await getEbook(env, o.slug)) || { title: o.slug, files: { items: [] } };
  const items = (e.files && e.files.items) || [];
  const expires = (o.paid_at || 0) + DL_HOURS * 3600;
  if (now() > expires) return dlPage('Lien expiré', '<h1>Ce lien a expiré.</h1><p>Il était valable ' + DL_HOURS + ' heures après ton achat.</p>' + help);
  let used = {};
  try { used = JSON.parse(o.dl || '{}'); } catch {}

  const pdfSlug = e.pdf_slug || o.slug; // la page de test réutilise les fichiers du vrai produit
  const findTip = '<p>Ton fichier est sur ton téléphone : ouvre l’application <strong>Fichiers</strong> (ou <strong>Mes fichiers</strong> sur Android), puis le dossier <strong>Téléchargements</strong>. Sur iPhone, regarde dans <strong>Fichiers</strong>, puis <strong>Téléchargements</strong> ou <strong>Sur mon iPhone</strong>.</p>';

  if (idxStr !== undefined) {
    const i = parseInt(idxStr, 10);
    if (!items[i]) return err(404, 'not_found');
    const key = '$."' + i + '"';
    const release = () => env.DB.prepare("UPDATE orders SET dl=json_set(dl, ?1, MAX(0, json_extract(dl, ?1) - 1)) WHERE reference=?2").bind(key, ref).run();
    const ticketFor = async (exp) => exp + '.' + (await hmacHex('SHA-256', (env.DL_SECRET || env.PAYSTACK_SECRET_KEY) + ':t', `${ref}|${i}|${exp}`)).slice(0, 24);

    if (req.method === 'POST') {
      // Le clic sur « Télécharger » est compté ici, une seule fois.
      const res = await env.DB.prepare(
        "UPDATE orders SET dl=json_set(dl, ?1, COALESCE(json_extract(dl, ?1), 0) + 1) WHERE reference=?2 AND COALESCE(json_extract(dl, ?1), 0) < ?3"
      ).bind(key, ref, DL_PER_FILE).run();
      if (res.meta.changes !== 1) {
        return dlPage('Fichier déjà téléchargé', '<h1>Ce fichier a déjà été téléchargé.</h1>' + findTip + '<p>Tu ne le trouves pas ?</p>' + help);
      }
      // Puis on renvoie vers une adresse temporaire (10 min) : certains téléphones Android
      // redemandent le fichier eux-mêmes, sans le clic d'origine ; cette adresse le leur permet.
      const t = await ticketFor(now() + 600);
      return Response.redirect(`${url.origin}/telecharger/${ref}/${sig}/${i}?t=${t}`, 303);
    }
    const t = url.searchParams.get('t') || '';
    const tm = t.match(/^(\d{10})\.([0-9a-f]{24})$/);
    if (!tm || +tm[1] < now() || !safeEqual(t, await ticketFor(tm[1]))) {
      return Response.redirect(`${url.origin}/telecharger/${ref}/${sig}`, 303);
    }
    const file = await env.FILES.getWithMetadata(`pdf/${pdfSlug}/${i}.pdf`, { type: 'arrayBuffer' });
    if (!file.value) {
      await release();
      return dlPage('Fichier indisponible', '<h1>Ce fichier n’est pas disponible pour le moment.</h1>' + help);
    }
    const bytes = new Uint8Array(file.value);
    const name = (file.metadata && file.metadata.name) || `${String(i + 1).padStart(2, '0')} - ${items[i].name}.pdf`;
    // Filigrane « Exemplaire personnel de <e-mail> » : ajouté à la fin du fichier, sans le réécrire.
    let tail = new Uint8Array(0);
    try {
      let idx = await env.FILES.get(`pdfidx/${pdfSlug}/${i}.json`, { type: 'json' });
      if (!idx || idx.len !== bytes.length) {
        idx = indexPdf(bytes);
        await env.FILES.put(`pdfidx/${pdfSlug}/${i}.json`, JSON.stringify(idx));
      }
      // Assez grand et assez foncé pour que l'acheteur le voie : c'est ce qui dissuade de partager le fichier.
      tail = stampTail(idx, 'Exemplaire personnel de ' + o.email + '. Merci de ne pas le diffuser.', { skipFirst: true, size: 9, gray: 0.3 });
    } catch (err2) {
      console.error('filigrane', pdfSlug, i, err2 && err2.message);
    }
    // Envoi par morceaux, avec la taille annoncée (le téléphone sait quand le fichier est complet).
    const total = bytes.length + tail.length;
    const { readable, writable } = new FixedLengthStream(total);
    ctx.waitUntil((async () => {
      const w = writable.getWriter();
      try {
        const CH = 64 * 1024;
        for (let at = 0; at < bytes.length; at += CH) await w.write(bytes.subarray(at, Math.min(bytes.length, at + CH)));
        if (tail.length) await w.write(tail);
        await w.close();
      } catch (e3) {
        try { await w.abort(); } catch {}
      }
    })());
    return new Response(readable, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  const left = Math.max(0, Math.round((expires - now()) / 3600));
  const rows = items.map((f, i) => {
    const n = used[String(i)] || 0;
    const form = (label, cls) => `<form method="post" action="/telecharger/${ref}/${sig}/${i}"><button class="${cls}" type="submit">${label}</button></form>`;
    const head = `${f.cover ? `<img src="${escH(f.cover)}" alt="">` : ''}<div class="dl-txt"><strong>${escH(f.name)}</strong>${f.pages ? `<span>${f.pages}&nbsp;pages</span>` : ''}</div>`;
    if (n === 0) return `<li class="dl-item">${head}${form('Télécharger', 'btn btn-primary')}</li>`;
    return `<li class="dl-item done">${head}<span class="dl-done">Téléchargé</span>` +
      (n < DL_PER_FILE ? `<div class="dl-retry">Le téléchargement a échoué ? ${form('Réessayer', 'linkbtn')}</div>` : '') + '</li>';
  }).join('');
  const anyDone = Object.values(used).some((n) => n > 0);
  return dlPage('Tes fichiers',
    `<h1>Tes fichiers</h1><p class="dl-lead">${escH(e.title)}</p>` +
    `<p class="dl-warn">Chaque fichier se télécharge une seule fois. Enregistre-le sur ton téléphone dès qu’il est téléchargé. Ce lien expire dans environ ${left}&nbsp;h.</p>` +
    `<ul class="dl-list">${rows}</ul>` +
    (anyDone ? `<div class="dl-find">${findTip}</div>` : '') +
    `<p class="dl-tip">Pour remplir le Workbook directement dans le PDF, ouvre-le avec Adobe Acrobat Reader, gratuit sur Android et iPhone.</p>` +
    `<details class="dl-help"><summary>Un problème ?</summary>${help}</details>`);
}


// ───────────────────────── pages de vente déposées en HTML ─────────────────────────
// Le fichier de Lamine est servi tel quel, mais : JavaScript retiré (sécurité de l'admin),
// {{prix}} remplacé par le prix réel, fenêtre de paiement + liens de retour et légaux ajoutés.
const MAX_HTML_BYTES = 3 * 1024 * 1024;
function escA(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function ebookHtmlPage(env, url, slug, e) {
  let html = await env.FILES.get(`html/${slug}.html`, { type: 'text' });
  if (!html) {
    const r = dlPage('Page en préparation', '<h1>Cette page arrive bientôt.</h1><p><a class="btn btn-primary" href="/">Retour à la boutique</a></p>');
    return new Response(r.body, { status: 404, headers: r.headers });
  }
  const price = parseInt(e.price, 10) || 0;
  html = html.split('{{prix}}').join(fcfa(price)).split('{{titre}}').join(escA(e.title || ''));
  const lower = html.slice(0, 20000).toLowerCase();
  const img = e.cover ? new URL(e.cover, url.origin).href : url.origin + '/public/images/logo.png';
  let head = `<link rel="stylesheet" href="/assets/buy.css"><link rel="canonical" href="${url.origin}/ebook/${slug}">`;
  if (!lower.includes('name="viewport"')) head += '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (!lower.includes('og:image')) head += `<meta property="og:image" content="${escA(img)}">`;
  if (!lower.includes('og:title')) head += `<meta property="og:title" content="${escA((e.seo && e.seo.title) || e.title || '')}">`;
  if (e.hidden) head += '<meta name="robots" content="noindex, nofollow">';
  const data = JSON.stringify({ ...e, slug }).replace(/</g, '\\u003c');
  const top = `<div class="dlb-top"><a href="/" class="dlb-brand">Dilam B'</a><a href="/" class="dlb-back">Retour à la boutique</a></div>`;
  const foot = `<div class="dlb-foot"><a href="/conditions">Conditions de vente</a><a href="/confidentialite">Confidentialité</a><a href="/">La boutique</a></div>` +
    `<div class="dlb-sheet" id="dlbSheet" hidden><div class="dlb-scrim" data-dlb-close></div><div class="dlb-panel" role="dialog" aria-modal="true" aria-labelledby="dlbTitle"><div class="dlb-head"><strong id="dlbTitle">Recevoir les fichiers</strong><button type="button" class="dlb-x" data-dlb-close aria-label="Fermer">×</button></div><div class="dlb-body" id="dlbBody"></div></div></div>` +
    `<script type="application/json" id="ebdata">${data}</script><script src="/assets/buy.js" defer></script>`;
  const strip = {
    element(el) {
      for (const [name, value] of [...el.attributes]) {
        if (/^on/i.test(name) || (/^(href|src|action|formaction|xlink:href)$/i.test(name) && /^\s*javascript:/i.test(value))) el.removeAttribute(name);
      }
    },
  };
  const res = new HTMLRewriter()
    .on('script', { element(el) { el.remove(); } })
    .on('noscript, base, object, embed, meta[http-equiv]', { element(el) { el.remove(); } })
    .on('*', strip)
    .on('head', { element(el) { el.append(head, { html: true }); } })
    .on('body', { element(el) { el.prepend(top, { html: true }); el.append(foot, { html: true }); } })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  return new Response(res.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function uploadHtml(req, env, url) {
  const slug = url.searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return err(400, 'bad_slug');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_HTML_BYTES) return err(413, 'too_large');
  const text = new TextDecoder().decode(buf);
  if (!/<html|<body|<!doctype/i.test(text.slice(0, 5000))) return err(415, 'not_html');
  const row = await env.DB.prepare("SELECT data FROM docs WHERE col='ebooks' AND id=?").bind(slug).first();
  if (!row) return err(404, 'ebook_missing');
  await env.FILES.put(`html/${slug}.html`, text, { metadata: { size: buf.byteLength, at: now() } });
  await env.DB.prepare("UPDATE docs SET data=json_set(data,'$.mode','html'), updated_at=? WHERE col='ebooks' AND id=?").bind(now(), slug).run();
  const warn = [];
  if (!/#acheter/.test(text)) warn.push('no_buy_link');
  if (/<script/i.test(text)) warn.push('scripts_removed');
  return json({ ok: true, size: buf.byteLength, warn }, 201);
}
async function htmlInfo(env, url) {
  const slug = url.searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return err(400, 'bad_slug');
  const l = await env.FILES.list({ prefix: `html/${slug}.html` });
  const k = l.keys[0];
  return json(k ? { exists: true, ...(k.metadata || {}) } : { exists: false });
}

// ───────────────────────── dépôt des PDF (admin) ─────────────────────────
async function uploadPdf(req, env, url) {
  const slug = url.searchParams.get('slug') || '';
  const i = parseInt(url.searchParams.get('i') || '', 10);
  const name = (url.searchParams.get('name') || '').slice(0, 150);
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !(i >= 0 && i < 20)) return err(400, 'bad_target');
  const ct = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/pdf') return err(415, 'bad_type');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_PDF_BYTES) return err(413, 'too_large');
  const head = new Uint8Array(buf.slice(0, 5));
  if (String.fromCharCode(...head) !== '%PDF-') return err(415, 'not_pdf');
  await env.FILES.put(`pdf/${slug}/${i}.pdf`, buf, { metadata: { name: name || `${i + 1}.pdf`, size: buf.byteLength, at: now() } });
  let wm = true;
  try {
    await env.FILES.put(`pdfidx/${slug}/${i}.json`, JSON.stringify(indexPdf(new Uint8Array(buf))));
  } catch (e) {
    wm = false;
    await env.FILES.delete(`pdfidx/${slug}/${i}.json`);
    console.error('index pdf', slug, i, e && e.message);
  }
  return json({ ok: true, size: buf.byteLength, watermark: wm }, 201);
}
async function listPdf(env, url) {
  const slug = url.searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return err(400, 'bad_slug');
  const l = await env.FILES.list({ prefix: `pdf/${slug}/` });
  const idx = await env.FILES.list({ prefix: `pdfidx/${slug}/` });
  const ok = new Set(idx.keys.map((k) => k.name.replace('pdfidx/', 'pdf/').replace(/\.json$/, '.pdf')));
  return json(l.keys.map((k) => ({ key: k.name, watermark: ok.has(k.name), ...(k.metadata || {}) })));
}
async function listOrders(env) {
  const { results } = await env.DB.prepare('SELECT reference,slug,email,amount,status,created_at,paid_at,channel,mailed,dl FROM orders ORDER BY created_at DESC LIMIT 200').all();
  return json(results);
}

function decodeURISafe(u) { try { return decodeURI(u); } catch { return u; } }

// ───────────────────────── routeur ─────────────────────────
async function api(req, env, ctx, url) {
  const p = url.pathname;
  const m = req.method;

  // Toute écriture doit venir du site lui-même (protection CSRF) :
  // en-tête personnalisé obligatoire + origine identique si le navigateur l'annonce.
  // Le webhook vient des serveurs de Paystack : il est authentifié par sa signature, pas par l'origine.
  if (p === '/api/paystack/webhook' && m === 'POST') return paystackWebhook(req, env, ctx);

  if (m !== 'GET' && m !== 'HEAD') {
    if (req.headers.get('X-Dilam') !== '1') return err(403, 'forbidden');
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return err(403, 'bad_origin');
  }

  if (p === '/api/auth/request' && m === 'POST') return authRequest(req, env);
  if (p === '/api/auth/verify' && m === 'POST') return authVerify(req, env);
  if (p === '/api/auth/logout' && m === 'POST') return authLogout(req, env);
  if (p === '/api/auth/pin' && m === 'POST') return authPin(req, env);
  if (p === '/api/auth/forget' && m === 'POST') return authForget(req, env);
  if (p === '/api/auth/me' && m === 'GET') return json({ admin: await isAdmin(req, env), pin: !!env.ADMIN_PIN, device: !!env.ADMIN_PIN && !!(await getDevice(req, env)) });

  if (p === '/api/stats/hit' && m === 'POST') return statsHit(req, env);
  if (p === '/api/capi' && m === 'POST') return capiPublic(req, env, ctx);
  if (p === '/api/checkout' && m === 'POST') return checkout(req, env);
  if (p === '/api/order' && m === 'GET') return orderStatus(req, env, ctx, url);

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
    if (p === '/api/admin/video' && m === 'POST') return uploadVideo(req, env);
    if (p === '/api/admin/video' && m === 'DELETE') return deleteVideo(env, url);
    if (p === '/api/admin/capi' && m === 'POST') return capiAdmin(req, env);
    if (p === '/api/admin/migrate' && m === 'POST') return migrate(req, env);
    if (p === '/api/admin/pdf' && m === 'POST') return uploadPdf(req, env, url);
    if (p === '/api/admin/pdf' && m === 'GET') return listPdf(env, url);
    if (p === '/api/admin/orders' && m === 'GET') return listOrders(env);
    if (p === '/api/admin/ebook-html' && m === 'POST') return uploadHtml(req, env, url);
    if (p === '/api/admin/ebook-html' && m === 'GET') return htmlInfo(env, url);
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
        res = await serveMedia(req, url.pathname, env);
      } else if (url.pathname.startsWith('/telecharger/')) {
        res = await download(req, env, ctx, url);
      } else if (/^\/ebook\/[a-z0-9-]{1,80}\/?$/.test(url.pathname)) {
        res = await ebookPage(req, env, url);
      } else if (url.pathname === '/' && url.searchParams.get('livre')) {
        res = await bookPage(req, env, url);
      } else if (url.pathname === '/') {
        res = await homePage(req, env, url);
      } else if (url.pathname === '/sitemap.xml') {
        res = await sitemap(env, url);
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
