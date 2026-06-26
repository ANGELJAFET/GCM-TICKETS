const path = require('path');

const ROOT    = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'uploads');
const PUBLIC  = path.join(ROOT, 'public');
const PORT    = parseInt(process.env.PORT || '3000');

module.exports = { ROOT, UPLOADS, PUBLIC, PORT };
