/**
 * Búsqueda de texto libre compartida por los buscadores del panel (inventario,
 * autocompletados, etc.). La idea es que el usuario pueda escribir como habla
 * ("dell color negro", "monitor bueno planta") y encuentre lo que espera, sin
 * tener que respetar el orden ni la redacción exacta de los campos.
 */

/** Minúsculas y sin acentos, para que "danado" o "prestamo" encuentren "Dañado" y "En préstamo". */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Palabras de relleno que el usuario escribe para describir *qué* está
 * buscando ("dell **color** negro", "monitor **en** planta") y que no forman
 * parte de los datos del equipo. Se ignoran como término obligatorio para que
 * no vacíen el resultado; si el texto del ítem sí las contiene, igual coinciden.
 */
const RELLENO = new Set([
  'color', 'marca', 'modelo', 'serie', 'nro', 'no', 'num', 'numero', 'tipo', 'equipo', 'equipos',
  'ubicacion', 'estado', 'condicion', 'responsable', 'departamento', 'empleado', 'fecha',
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'y', 'o', 'con', 'para', 'por', 'que', 'al', 'a',
]);

/**
 * Un término coincide como subcadena, o en su forma singular, para que
 * "monitores" o "laptops" encuentren "Monitor" y "Laptop".
 */
function incluyeTermino(objetivo: string, t: string): boolean {
  if (objetivo.includes(t)) return true;
  if (t.length > 4 && t.endsWith('es') && objetivo.includes(t.slice(0, -2))) return true;
  if (t.length > 3 && t.endsWith('s') && objetivo.includes(t.slice(0, -1))) return true;
  return false;
}

/**
 * `true` si todos los términos de `query` aparecen en `texto`, en cualquier
 * orden y como subcadena (las palabras de relleno no son obligatorias).
 * Una búsqueda vacía —o compuesta solo de relleno— coincide con todo.
 * @param texto Texto del ítem donde buscar (se normaliza internamente).
 * @param query Lo que escribió el usuario.
 */
export function matchesQuery(texto: string, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  const objetivo = normalizeText(texto);
  return q.split(/\s+/).every((t) => RELLENO.has(t) || incluyeTermino(objetivo, t));
}
