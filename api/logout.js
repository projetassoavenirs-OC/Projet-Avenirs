import { handler, sendJson } from '../lib/http.js';
import { clearSession } from '../lib/auth.js';

// POST /api/logout
export default handler(['POST'], async (req, res) => {
  clearSession(req, res);
  sendJson(res, 200, { ok: true });
});
