// Images embarquées dans le code (public/images), générées à partir des pièces jointes Airtable.
// Quand une pièce jointe Airtable porte le même nom de fichier, l'application affiche la copie
// locale (lien permanent, chargement rapide) ; sinon elle affiche l'image hébergée par Airtable.
// Pour ajouter une image : la déposer dans public/images sous son nom « slugifié » et l'ajouter ici.
export const LOCAL_IMAGES = new Set([
  "agathe.jpg",
  "animalia.jpg",
  "atelier-cuisine.jpg",
  "bonne-nuit-gorille.jpg",
  "conte-lds.jpg",
  "conte.jpg",
  "le-petit-chaperon-rouge.jpg",
  "louis.jpg",
  "piscine.jpg",
  "solveig.jpg"
]);

export function slugify(filename) {
  const base = String(filename || '').replace(/\.[^.]+$/, '');
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
}

export function localImageFor(filename) {
  const name = slugify(filename);
  return LOCAL_IMAGES.has(name) ? `/images/${name}` : null;
}
