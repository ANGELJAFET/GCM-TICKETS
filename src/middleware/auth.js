const jwt = require('jsonwebtoken');
const { SESSION_SECRET } = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });

  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    req.user = {
      id: payload.id, username: payload.username,
      nombre: payload.nombre, rol_nivel: payload.rol_nivel
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireRole(minNivel) {
  return [requireAuth, (req, res, next) => {
    if (req.user.rol_nivel < minNivel)
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    next();
  }];
}

module.exports = { requireAuth, requireRole };
