// Client Airtable minimal, exécuté UNIQUEMENT côté serveur.
// Le jeton n'est jamais envoyé au navigateur.

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export function isRecordId(value) {
  return typeof value === 'string' && RECORD_ID.test(value);
}

function config() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    throw new HttpError(500, 'Configuration Airtable manquante côté serveur.');
  }
  // AIRTABLE_API_URL ne sert qu'aux tests locaux (serveur Airtable simulé).
  const apiUrl = (process.env.AIRTABLE_API_URL || 'https://api.airtable.com').replace(/\/$/, '');
  return { token, baseId, apiUrl };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', params = [], body } = {}) {
  const { token, baseId, apiUrl } = config();
  const url = new URL(`${apiUrl}/v0/${baseId}/${path}`);
  for (const [key, value] of params) {
    if (value !== undefined && value !== null) url.searchParams.append(key, value);
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`Airtable ${method} ${path} → ${res.status}`, detail.slice(0, 500));
    throw new HttpError(502, 'La base de données est momentanément indisponible.');
  }
  return res.json();
}

/**
 * Liste des enregistrements (pagination gérée).
 * @param {string} table  identifiant de table
 * @param {{formula?: string, sort?: {field: string, direction?: 'asc'|'desc'}[], fields?: string[]}} opts
 */
export async function listRecords(table, { formula, sort = [], fields = [] } = {}) {
  const records = [];
  let offset;
  do {
    const query = { returnFieldsByFieldId: 'true', filterByFormula: formula, offset, pageSize: '100' };
    sort.forEach((s, i) => {
      query[`sort[${i}][field]`] = s.field;
      query[`sort[${i}][direction]`] = s.direction || 'asc';
    });
    const params = Object.entries(query);
    fields.forEach((f) => params.push(['fields[]', f]));
    const data = await request(table, { params });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

/** Récupère des enregistrements par identifiants (validés). */
export async function getRecordsByIds(table, ids, opts = {}) {
  const safe = ids.filter(isRecordId);
  if (safe.length === 0) return [];
  const formula = `OR(${safe.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
  return listRecords(table, { ...opts, formula });
}

export async function getRecord(table, id) {
  if (!isRecordId(id)) throw new HttpError(404, 'Introuvable.');
  const [record] = await getRecordsByIds(table, [id]);
  if (!record) throw new HttpError(404, 'Introuvable.');
  return record;
}

export async function updateRecord(table, id, fields) {
  if (!isRecordId(id)) throw new HttpError(404, 'Introuvable.');
  const data = await request(table, {
    method: 'PATCH',
    body: { records: [{ id, fields }], returnFieldsByFieldId: true },
  });
  return data.records[0];
}
