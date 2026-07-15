import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { SESSION_SECRET } from '../config';
import db from '../db';
import { JwtUser } from '../types';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });

  try {
    const payload = jwt.verify(token, SESSION_SECRET, { algorithms: ['HS256'] }) as unknown as JwtUser;
    req.user = {
      id: payload.id, username: payload.username,
      nombre: payload.nombre, rol_nivel: payload.rol_nivel
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireRole(minNivel: number): [RequestHandler, RequestHandler] {
  return [requireAuth, (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.rol_nivel < minNivel)
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    next();
  }];
}

// Columnas de permiso por módulo que el superadmin puede otorgar. La clave es
// el nombre corto usado en rutas/frontend; el valor es la columna real en
// `usuarios` (whitelist fija, nunca se interpola texto del cliente en el SQL).
const MODULOS_ACCESO: Record<string, string> = {
  inventario:  'acceso_inventario',
  prestamos:   'acceso_prestamos',
  bitacora:    'acceso_bitacora',
  solicitudes: 'acceso_solicitudes',
  usuarios:    'acceso_usuarios'
};

// Superadmin (nivel 4) siempre pasa. Cualquier otro usuario necesita que el
// superadmin le haya otorgado el permiso del módulo correspondiente.
// Se consulta la BD en cada request (no se confía en el JWT) para que una
// revocación surta efecto de inmediato, sin esperar a que expire el token.
function requireSuperadminOrAcceso(modulo: string): [RequestHandler, RequestHandler] {
  const columna = MODULOS_ACCESO[modulo];
  if (!columna) throw new Error(`Módulo de acceso desconocido: ${modulo}`);

  return [requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.rol_nivel >= 4) return next();
    try {
      const u = await db.queryOne<{ acceso: boolean | number }>(`SELECT ${columna} AS acceso FROM usuarios WHERE id = ?`, [req.user!.id]);
      if (u && u.acceso) return next();
      return res.status(403).json({ error: 'Esta sección requiere acceso otorgado por el superadministrador' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al verificar permisos' });
    }
  }];
}

export { requireAuth, requireRole, requireSuperadminOrAcceso, MODULOS_ACCESO };
