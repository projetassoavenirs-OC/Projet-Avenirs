// Transformation des enregistrements Airtable en objets simples pour l'interface.
import { TABLES, ENFANT, EVENEMENT } from './schema.js';
import { listRecords, getRecord, getRecordsByIds, updateRecord, HttpError } from './airtable.js';
import { localImageFor } from './local-images.js';

function attachment(value, size = 'large') {
  const file = Array.isArray(value) ? value[0] : null;
  if (!file) return null;
  // Copie locale embarquée dans le code si elle existe (même nom de fichier que dans Airtable).
  const local = localImageFor(file.filename);
  if (local) return { url: local, full: local, width: file.width || null, height: file.height || null };
  return {
    url: file.thumbnails?.[size]?.url || file.url,
    full: file.thumbnails?.full?.url || file.url,
    width: file.width || null,
    height: file.height || null,
  };
}

// « Je sais compter jusqu'à 10, J'écoute les consignes » → liste.
// On coupe sur les retours à la ligne, ou sur une virgule suivie d'une majuscule
// (pour ne pas couper une compétence qui contiendrait elle-même une virgule).
export function splitSkills(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n|,\s*(?=\p{Lu})|;\s*/u)
    .map((s) => s.replace(/^[-•·\s]+/, '').trim())
    .filter(Boolean);
}

// « Cacahuètes, lait » → ['Cacahuètes', 'Lait']
export function splitAllergies(text) {
  if (!text) return [];
  return String(text)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capitalize);
}

function capitalize(s) {
  return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);
}

export function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .toLowerCase()
    .replace(/s\b/g, '')
    .trim();
}

function childSummary(r) {
  const f = r.fields;
  return {
    id: r.id,
    prenom: f[ENFANT.prenom] || 'Sans prénom',
    photo: attachment(f[ENFANT.photo]),
  };
}

export async function listChildren() {
  const records = await listRecords(TABLES.enfants, {
    fields: [ENFANT.id, ENFANT.prenom, ENFANT.photo],
    sort: [{ field: ENFANT.id }],
  });
  return records.map(childSummary);
}

export async function getChild(id) {
  const r = await getRecord(TABLES.enfants, id);
  const f = r.fields;
  const livre = f[ENFANT.livre]
    ? { titre: f[ENFANT.livre], auteur: f[ENFANT.auteur] || null, couverture: attachment(f[ENFANT.couverture]) }
    : null;
  return {
    ...childSummary(r),
    acquises: splitSkills(f[ENFANT.acquises]),
    enCours: splitSkills(f[ENFANT.enCours]),
    livre,
    allergies: splitAllergies(f[ENFANT.allergies]),
    evenementIds: (f[ENFANT.evenements] || []).map((l) => (typeof l === 'string' ? l : l.id)),
  };
}

function eventFromRecord(r, { withSummary = false } = {}) {
  const f = r.fields;
  return {
    id: r.id,
    titre: f[EVENEMENT.titre] || 'Sortie',
    dateDebut: f[EVENEMENT.dateDebut] || null,
    heureDebut: f[EVENEMENT.heureDebut] || null,
    dateFin: f[EVENEMENT.dateFin] || null,
    heureFin: f[EVENEMENT.heureFin] || null,
    lieu: f[EVENEMENT.lieu] || null,
    image: attachment(f[EVENEMENT.image]),
    ...(withSummary ? { resume: f[EVENEMENT.resume] || '' } : {}),
  };
}

/** Sorties liées à un enfant, triées par date. */
export async function listEventsForChild(childId) {
  const child = await getChild(childId);
  const records = await getRecordsByIds(TABLES.evenements, child.evenementIds, {
    sort: [{ field: EVENEMENT.dateDebut }, { field: EVENEMENT.heureDebut }],
  });
  return { child: { id: child.id, prenom: child.prenom }, events: records.map((r) => eventFromRecord(r)) };
}

/** Détail d'une sortie — uniquement si elle concerne bien cet enfant. */
export async function getEventForChild(childId, eventId) {
  const child = await getChild(childId);
  if (!child.evenementIds.includes(eventId)) throw new HttpError(404, 'Sortie introuvable pour cet enfant.');
  const r = await getRecord(TABLES.evenements, eventId);
  return {
    child: { id: child.id, prenom: child.prenom, allergies: child.allergies },
    event: eventFromRecord(r, { withSummary: true }),
  };
}

const MAX_ALLERGY_LENGTH = 60;

export async function addAllergy(childId, value) {
  const label = capitalize(String(value || '').replace(/\s+/g, ' ').trim());
  if (!label) throw new HttpError(400, 'Merci de saisir une allergie.');
  if (label.length > MAX_ALLERGY_LENGTH || /[,;\n]/.test(label)) {
    throw new HttpError(400, 'Une allergie à la fois, sans virgule (60 caractères max).');
  }
  const child = await getChild(childId);
  if (child.allergies.some((a) => normalize(a) === normalize(label))) {
    throw new HttpError(409, `« ${label} » est déjà enregistrée.`);
  }
  const allergies = [...child.allergies, label];
  await updateRecord(TABLES.enfants, childId, { [ENFANT.allergies]: allergies.join(', ') });
  return allergies;
}

export async function removeAllergy(childId, value) {
  const child = await getChild(childId);
  const allergies = child.allergies.filter((a) => normalize(a) !== normalize(value));
  if (allergies.length === child.allergies.length) throw new HttpError(404, 'Allergie introuvable.');
  await updateRecord(TABLES.enfants, childId, { [ENFANT.allergies]: allergies.join(', ') });
  return allergies;
}
