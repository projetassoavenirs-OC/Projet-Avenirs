import { handler, getQuery, sendJson } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { listChildren, getChild } from '../lib/data.js';

// GET /api/children          → liste des enfants (photo + prénom)
// GET /api/children?id=rec…  → profil complet d'un enfant
export default handler(['GET'], async (req, res) => {
  requireUser(req);
  const { id } = getQuery(req);
  if (id) {
    const { evenementIds, ...child } = await getChild(id);
    return sendJson(res, 200, { child });
  }
  sendJson(res, 200, { children: await listChildren() });
});
