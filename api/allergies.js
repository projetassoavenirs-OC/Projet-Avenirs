import { handler, getQuery, readJson, sendJson } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { addAllergy, removeAllergy } from '../lib/data.js';
import { HttpError } from '../lib/airtable.js';

// POST   /api/allergies?child=rec…  { allergie }  → ajoute une allergie
// DELETE /api/allergies?child=rec…  { allergie }  → retire une allergie
export default handler(['POST', 'DELETE'], async (req, res) => {
  requireUser(req);
  const { child } = getQuery(req);
  if (!child) throw new HttpError(400, 'Enfant non précisé.');
  const { allergie } = await readJson(req);
  const allergies = req.method === 'POST' ? await addAllergy(child, allergie) : await removeAllergy(child, allergie);
  sendJson(res, 200, { allergies });
});
