import { handler, readJson, sendJson } from '../lib/http.js';
import { checkCredentials, checkRateLimit, setSession } from '../lib/auth.js';
import { HttpError } from '../lib/airtable.js';

// POST /api/login  { username, password }
export default handler(['POST'], async (req, res) => {
  const reset = checkRateLimit(req);
  const { username, password } = await readJson(req);
  const user = checkCredentials(username, password);
  if (!user) throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
  reset();
  setSession(req, res, user);
  sendJson(res, 200, { user });
});
