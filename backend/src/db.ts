import 'dotenv/config';
import sql from 'mssql';
import bcrypt from 'bcrypt';

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

let pool: sql.ConnectionPool | null = null;

// Traduce sintaxis MySQL → T-SQL para las queries inline que quedan
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

// Query inline con parámetros posicionales (?)
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

async function queryOne<T = any>(sqlText: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows[0] || null;
}

// Llama a un stored procedure con parámetros nombrados { param: value, ... }
async function exec<T = any>(spName: string, params: Record<string, any> = {}): Promise<T[]> {
  const req = pool!.request();
  for (const [name, val] of Object.entries(params)) {
    req.input(name, val);
  }
  const result = await req.execute(spName);
  return result.recordset ?? [];
}

async function execOne<T = any>(spName: string, params: Record<string, any> = {}): Promise<T | null> {
  const rows = await exec<T>(spName, params);
  return rows[0] ?? null;
}

// Incrementa un contador de forma atómica y retorna el nuevo ID formateado
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

interface UsuarioBasico {
  id: number;
  display: string;
  username: string;
}

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
