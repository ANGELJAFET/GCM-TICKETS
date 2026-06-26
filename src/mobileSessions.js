const fs = require('fs');

const mobileSessions = new Map();
const SESSION_TTL    = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, s] of mobileSessions) {
    if (s.expiresAt < now) {
      if (s.filePath && fs.existsSync(s.filePath)) fs.unlink(s.filePath, () => {});
      mobileSessions.delete(token);
    }
  }
}, 60_000);

module.exports = { mobileSessions, SESSION_TTL };
