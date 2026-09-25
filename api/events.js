import { handler, getQuery, sendJson } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { listEventsForChild, getEventForChild } from '../lib/data.js';
import { HttpError } from '../lib/airtable.js';

// GET /api/events?child=rec…          → sorties de l'enfant
// GET /api/events?child=rec…&id=rec…  → détail d'une sortie
export default handler(['GET'], async (req, res) => {
  requireUser(req);
  const { child, id } = getQuery(req);
  if (!child) throw new HttpError(400, 'Enfant non précisé.');
  sendJson(res, 200, id ? await getEventForChild(child, id) : await listEventsForChild(child));
});
