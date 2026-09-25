// Authentification : mot de passe vérifié via scrypt, session dans un cookie
// HttpOnly signé (HMAC-SHA256). Aucune dépendance externe.
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { HttpError } from './airtable.js';

const COOKIE = 'avenirs_session';
const SESSION_TTL = 7 * 24 * 3600; // 7 jours, en secondes

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new HttpError(500, 'SESSION_SECRET manquant ou trop court.');
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Format de l'empreinte : scrypt$<sel base64url>$<hash base64url> */
export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${b64url(salt)}$${b64url(hash)}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = scryptSync(String(password), Buffer.from(saltB64, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vérifie identifiant + mot de passe contre les variables d'environnement. */
export function checkCredentials(username, password) {
  const expectedUser = process.env.PARENT_USERNAME || '';
  const hash = process.env.PARENT_PASSWORD_HASH || '';
  if (!expectedUser || !hash) throw new HttpError(500, 'Compte parent non configuré.');
  // On vérifie toujours le mot de passe (même si l'identifiant est faux) pour un temps de réponse constant.
  const passOk = verifyPassword(password || '', hash);
  const userOk = safeEqual(String(username || '').trim().toLowerCase(), expectedUser.toLowerCase());
  return passOk && userOk ? expectedUser : null;
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

function unsign(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(createHmac('sha256', secret()).update(body).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isSecure(req) {
  const host = req.headers.host || '';
  return !host.startsWith('localhost') && !host.startsWith('127.0.0.1');
}

export function setSession(req, res, username) {
  const token = sign({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL });
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_TTL}`];
  if (isSecure(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSession(req, res) {
  const attrs = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

/** Renvoie l'utilisateur connecté ou lève une erreur 401. */
export function requireUser(req) {
  const payload = unsign(parseCookies(req)[COOKIE]);
  if (!payload) throw new HttpError(401, 'Session expirée, merci de vous reconnecter.');
  return payload.u;
}

// Limitation simple des tentatives de connexion (par instance serverless).
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkRateLimit(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, since: now };
  if (now - entry.since > WINDOW_MS) {
    entry.count = 0;
    entry.since = now;
  }
  entry.count += 1;
  attempts.set(ip, entry);
  if (entry.count > MAX_ATTEMPTS) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
  return () => attempts.delete(ip); // à appeler après un succès
}
