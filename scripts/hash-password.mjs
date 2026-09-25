// Génère les valeurs à coller dans les variables d'environnement Vercel.
// Usage : npm run hash-password -- "MonMotDePasse"
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/auth.js';

const password = process.argv[2];
if (!password) {
  console.error('Usage : npm run hash-password -- "MonMotDePasse"');
  process.exit(1);
}
console.log(`PARENT_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('hex')}`);
