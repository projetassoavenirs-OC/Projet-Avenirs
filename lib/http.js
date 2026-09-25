// Petits utilitaires HTTP compatibles avec les fonctions Vercel (Node) et le serveur local.
import { HttpError } from './airtable.js';

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Données personnelles + URLs d'images Airtable temporaires : jamais mises en cache.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
}

export async function readJson(req) {
  let body;
  try {
    body = req.body; // Vercel analyse le JSON à la lecture (et lève une erreur s'il est invalide)
  } catch {
    throw new HttpError(400, 'Requête invalide.');
  }
  if (body !== undefined) {
    if (Buffer.isBuffer(body)) body = body.toString();
    if (typeof body === 'string') {
      try { return JSON.parse(body || '{}'); } catch { throw new HttpError(400, 'Requête invalide.'); }
    }
    return body || {};
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new HttpError(413, 'Requête trop volumineuse.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new HttpError(400, 'Requête invalide.'); }
}

/**
 * Protection CSRF pour les requêtes qui modifient des données :
 * JSON obligatoire + en-tête Origin identique à l'hôte.
 */
export function assertSameOrigin(req) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Format non supporté.');
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (new URL(origin).host !== host) throw new HttpError(403, 'Origine refusée.');
  }
}

/** Enveloppe un handler : méthodes autorisées + gestion d'erreurs homogène. */
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'Méthode non autorisée.');
      }
      if (req.method !== 'GET') assertSameOrigin(req);
      await fn(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      sendJson(res, status, { error: err instanceof HttpError ? err.message : 'Erreur serveur.' });
    }
  };
}
