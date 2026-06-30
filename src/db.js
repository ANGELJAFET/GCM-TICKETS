require('dotenv').config();
const sql    = require('mssql');
const bcrypt = require('bcrypt');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

const baseConfig = {
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'GcmApp@2024!',
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME     || 'gcm_tickets',
  options: {
    trustServerCertificate: true,
    encrypt: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool = null;

// Traduce sintaxis MySQL → T-SQL para las queries inline que quedan
function toTSQL(s) {
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
async function query(sqlText, params = []) {
  const req = pool.request();
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

async function queryOne(sqlText, params = []) {
  const rows = await query(sqlText, params);
  return rows[0] || null;
}

// Llama a un stored procedure con parámetros nombrados { param: value, ... }
async function exec(spName, params = {}) {
  const req = pool.request();
  for (const [name, val] of Object.entries(params)) {
    req.input(name, val);
  }
  const result = await req.execute(spName);
  return result.recordset ?? [];
}

async function execOne(spName, params = {}) {
  const rows = await exec(spName, params);
  return rows[0] ?? null;
}

// Incrementa un contador de forma atómica y retorna el nuevo ID formateado
async function nextId(counter, prefix, padding = 3) {
  const req = pool.request();
  req.input('nombre', sql.NVarChar, counter);
  const result = await req.query(
    'UPDATE contadores SET valor = valor + 1 OUTPUT INSERTED.valor WHERE nombre = @nombre'
  );
  const row = result.recordset[0];
  if (!row) throw new Error(`Contador '${counter}' no encontrado`);
  return `${prefix}-${String(row.valor).padStart(padding, '0')}`;
}

async function isAdmin(username) {
  if (!username) return false;
  const user = await queryOne(
    `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
     WHERE u.username = ? AND r.nivel >= 3 AND u.activo = 1`,
    [username]
  );
  return !!user;
}

async function findEmailByNombre(nombre) {
  if (!nombre) return null;
  const row = await queryOne(
    `SELECT email FROM usuarios
     WHERE LOWER(LTRIM(RTRIM(CONCAT(nombre,' ',ISNULL(apellido,''))))) = LOWER(?) AND activo = 1`,
    [nombre]
  );
  return row?.email || null;
}

async function findUserByNombre(nombre) {
  if (!nombre || nombre === 'Sin asignar') return null;
  return await queryOne(
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

async function initDB() {
  try {
    pool = new sql.ConnectionPool(baseConfig);
    await pool.connect();
    console.log('✓ Conexión SQL Server establecida (gcm_tickets).');
  } catch (err) {
    console.error('✗ Error SQL Server:', err.message);
    console.error('  Asegúrate de haber ejecutado schema.sql y procedimientos.sql en SSMS.');
    process.exit(1);
  }
}

module.exports = { pool, query, queryOne, exec, execOne, nextId, isAdmin, findUserByNombre, findEmailByNombre, initDB, bcrypt, ROUNDS };
