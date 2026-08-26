/**
 * Cómo se identifica al personal del sistema en los selectores del panel.
 * La cuenta superadmin no expone su nombre real ni su rol: se muestra por su
 * username. El resto del staff sí se acompaña de su rol, que ayuda a saber a
 * quién se está eligiendo.
 */
import type { AdminUser } from './types';

/** Nivel de rol del superadmin (`roles.nivel`); espejo de `NIVEL_SUPERADMIN` en `api/src/ticketLoader.ts`. */
const NIVEL_SUPERADMIN = 4;

/**
 * Etiqueta de un miembro del staff para mostrar en un `<option>` o lista.
 * @param a Usuario de staff devuelto por `GET /api/admins`.
 * @returns El username a secas si es superadmin (ej. `"SOPORTEMILCIEN"`); si no, `"Nombre (rol)"`.
 */
export function staffLabel(a: AdminUser): string {
  if (a.nivel >= NIVEL_SUPERADMIN) return a.username;
  return `${a.nombre} (${a.rol})`;
}
