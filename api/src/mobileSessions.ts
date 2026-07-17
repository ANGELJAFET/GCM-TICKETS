import fs from 'fs';
import { MobileSession } from './types';

const mobileSessions = new Map<string, MobileSession>();
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

export { mobileSessions, SESSION_TTL };
