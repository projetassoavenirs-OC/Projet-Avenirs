import { handler, sendJson } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';

// GET /api/me → utilisateur connecté (401 sinon)
export default handler(['GET'], async (req, res) => {
  sendJson(res, 200, { user: requireUser(req) });
});
