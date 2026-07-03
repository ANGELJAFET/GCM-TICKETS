const path = require('path');

const ROOT    = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'uploads');
const PUBLIC  = path.join(ROOT, 'public');
const PORT    = parseInt(process.env.PORT || '3000');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) throw new Error('SESSION_SECRET no está configurado en .env');

module.exports = { UPLOADS, PUBLIC, PORT, SESSION_SECRET };
