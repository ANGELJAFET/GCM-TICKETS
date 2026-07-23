/**
 * Capa de acceso a datos: pool de conexión a SQL Server y helpers de consulta.
 *
 * Expone tres formas de acceder a la BD:
 * - `query`/`queryOne`: SQL inline con placeholders posicionales `?` (útil para
 *   queries ad-hoc que aún viven en las rutas).
 * - `exec`/`execOne`: llamadas a stored procedures (`procedimientos.sql`) con
 *   parámetros nombrados — la forma preferida para operaciones de negocio.
 * - `nextId`: generador de IDs legibles (ej. `TK-001`) basado en la tabla `contadores`.
 */
import 'dotenv/config';
import sql from 'mssql';
import bcrypt from 'bcrypt';

/** Costo de hashing de bcrypt para contraseñas. Configurable vía `BCRYPT_ROUNDS`. */
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('DB_PASSWORD no está configurado en .env');

const baseConfig: sql.config = {
  user:     process.env.DB_USER     || 'sa',
  password: dbPassword,
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME     || 'gcm_tickets',
  options: {
    trustServerCertificate: true,
    encrypt: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

/** Pool de conexión activo. `null` hasta que `initDB()` completa la conexión. */
let pool: sql.ConnectionPool | null = null;

/**
 * Traduce sintaxis MySQL a T-SQL para las queries inline que aún se escriben
 * con funciones estilo MySQL (herencia de un backend previo en ese motor).
 * @param s Texto SQL con posible sintaxis MySQL (`IFNULL`, `NOW()`, `TRUE`/`FALSE`, etc.)
 * @returns El mismo texto con las funciones equivalentes de T-SQL / SQL Server.
 */
function toTSQL(s: string): string {
  return s
    .replace(/TRIM\(CONCAT\(([^,]+),\s*' ',\s*IFNULL\(([^,]+),\s*''\)\)\)/g,
             "LTRIM(RTRIM(CONCAT($1,' ',ISNULL($2,''))))")
    .replace(/\bIFNULL\s*\(/gi,  'ISNULL(')
    .replace(/\bNOW\s*\(\)/gi,   'GETDATE()')
    .replace(/\bCURDATE\s*\(\)/gi, 'CAST(GETDATE() AS DATE)')
    .replace(/\bTRUE\b/g,  '1')
    .replace(/\bFALSE\b/g, '0');
}

/**
 * Ejecuta una query inline con parámetros posicionales `?` (traducidos a
 * `@p0`, `@p1`... para `mssql`), tras pasar el texto por {@link toTSQL}.
 * @param sqlText Sentencia SQL con `?` como marcadores de posición.
 * @param params Valores a bindear, en el mismo orden que los `?`.
 * @returns Arreglo de filas (`recordset`) devuelto por SQL Server.
 * @throws Si el pool no está inicializado (`initDB` no se llamó) o la query falla.
 */
async function query<T = any>(sqlText: string, params: any[] = []): Promise<T[]> {
  const req = pool!.request();
  let i = 0;
  const tsql = toTSQL(sqlText).replace(/\?/g, () => {
    const name = `p${i}`;
    req.input(name, params[i]);
    i++;
    return `@${name}`;
  });
  const result = await req.query(tsql);
  return result.recordset;
}

/**
 * Igual que {@link query}, pero retorna solo la primera fila (o `null` si no hay resultados).
 * @param sqlText Sentencia SQL con `?` como marcadores de posición.
 * @param params Valores a bindear, en el mismo orden que los `?`.
 * @returns La primera fila del resultado, o `null`.
 */
async function queryOne<T = any>(sqlText: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows[0] || null;
}

/**
 * Ejecuta un stored procedure (definido en `procedimientos.sql`) con parámetros nombrados.
 * @param spName Nombre del stored procedure a ejecutar.
 * @param params Mapa `{ nombreParametro: valor }` a bindear como parámetros de entrada.
 * @returns Arreglo de filas del primer recordset devuelto por el SP.
 * @throws Si el pool no está inicializado o el SP lanza un error de SQL Server.
 */
async function exec<T = any>(spName: string, params: Record<string, any> = {}): Promise<T[]> {
  const req = pool!.request();
  for (const [name, val] of Object.entries(params)) {
    req.input(name, val);
  }
  const result = await req.execute(spName);
  return result.recordset ?? [];
}

/**
 * Igual que {@link exec}, pero retorna solo la primera fila (o `null` si no hay resultados).
 * @param spName Nombre del stored procedure a ejecutar.
 * @param params Mapa `{ nombreParametro: valor }` a bindear como parámetros de entrada.
 */
async function execOne<T = any>(spName: string, params: Record<string, any> = {}): Promise<T | null> {
  const rows = await exec<T>(spName, params);
  return rows[0] ?? null;
}

/**
 * Incrementa de forma atómica (`UPDATE ... OUTPUT INSERTED.valor`) el contador
 * indicado en la tabla `contadores` y arma un ID legible con prefijo, p. ej.
 * `nextId('tickets', 'TK')` → `"TK-001"`, `"TK-002"`, ...
 * @param counter Nombre del contador en la tabla `contadores` (ej. `'tickets'`).
 * @param prefix Prefijo a anteponer al número (ej. `'TK'`).
 * @param padding Cantidad de dígitos con ceros a la izquierda (default 3).
 * @returns El ID formateado, ej. `"TK-001"`.
 * @throws Si el contador indicado no existe en la tabla `contadores`.
 */
async function nextId(counter: string, prefix: string, padding = 3): Promise<string> {
  const req = pool!.request();
  req.input('nombre', sql.NVarChar, counter);
  const result = await req.query(
    'UPDATE contadores SET valor = valor + 1 OUTPUT INSERTED.valor WHERE nombre = @nombre'
  );
  const row = result.recordset[0];
  if (!row) throw new Error(`Contador '${counter}' no encontrado`);
  return `${prefix}-${String(row.valor).padStart(padding, '0')}`;
}

/** Forma mínima de usuario usada para resolver referencias por nombre/username. */
interface UsuarioBasico {
  id: number;
  display: string;
  username: string;
}

/**
 * Busca un usuario activo por su nombre completo (`nombre + apellido`) o por
 * su `username`, indistintamente. Usado para resolver campos de texto libre
 * heredados (ej. "asignado a") a un usuario real cuando sea posible.
 * @param nombre Nombre completo o username a buscar. `null`/`undefined`/`'Sin asignar'` retornan `null` sin consultar la BD.
 * @returns El usuario encontrado (`id`, `display`, `username`), o `null` si no hay coincidencia activa.
 */
async function findUserByNombre(nombre: string | null | undefined): Promise<UsuarioBasico | null> {
  if (!nombre || nombre === 'Sin asignar') return null;
  return await queryOne<UsuarioBasico>(
    `SELECT TOP 1 id,
       LTRIM(RTRIM(CONCAT(nombre,' ',ISNULL(apellido,'')))) AS display,
       username
     FROM usuarios
     WHERE (LTRIM(RTRIM(CONCAT(nombre,' ',ISNULL(apellido,'')))) = ?
            OR username = ?)
       AND activo = 1`,
    [nombre, nombre]
  );
}

/**
 * Inicializa el pool de conexión a SQL Server usando la configuración de
 * `.env`. Debe llamarse una vez al arrancar el servidor (ver `server.ts`)
 * antes de aceptar peticiones HTTP.
 * @throws Termina el proceso (`process.exit(1)`) si la conexión falla —no lanza una excepción capturable.
 */
async function initDB(): Promise<void> {
  try {
    pool = new sql.ConnectionPool(baseConfig);
    await pool.connect();
    console.log('✓ Conexión SQL Server establecida (gcm_tickets).');
  } catch (err: any) {
    console.error('✗ Error SQL Server:', err.message);
    console.error('  Asegúrate de haber ejecutado schema.sql y procedimientos.sql en SSMS.');
    process.exit(1);
  }
}

export default { pool, query, queryOne, exec, execOne, nextId, findUserByNombre, initDB, bcrypt, ROUNDS };
