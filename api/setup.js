/**
 * Script de configuración inicial (y de actualización) de la base de datos.
 * Se ejecuta automáticamente desde `start.bat`, o manualmente con
 * `npm run setup` tras actualizar `schema.sql` / `procedimientos.sql`.
 *
 * Pasos que realiza (ver {@link main}):
 * 1. Crea la base de datos si no existe.
 * 2. Ejecuta `schema.sql` (tablas, roles, seeds, migraciones).
 * 3. Ejecuta `procedimientos.sql` (stored procedures).
 * 4. Crea el usuario `admin` (superadmin) inicial si aún no existe.
 *
 * Es idempotente: correrlo varias veces no duplica datos ni sobreescribe
 * al usuario `admin` si ya existe.
 */
require('dotenv').config();
const sql    = require('mssql');
const bcrypt = require('bcrypt');
const fs     = require('fs');
const path   = require('path');

const DB_NAME        = process.env.DB_NAME        || 'gcm_tickets';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BCRYPT_ROUNDS  = parseInt(process.env.BCRYPT_ROUNDS || '12');

if (!process.env.DB_PASSWORD) {
  console.error('✗ DB_PASSWORD no está configurado en .env');
  process.exit(1);
}

const baseConfig = {
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433'),
  options:  { trustServerCertificate: true, encrypt: false }
};

/**
 * Lee un archivo .sql y lo divide en batches separados por `GO` (convención
 * de SSMS que `mssql` no interpreta de forma nativa). Omite bloques `USE` y
 * `CREATE DATABASE`, ya que la conexión abierta apunta directamente a la BD
 * de destino.
 * @param {string} file Nombre del archivo .sql, relativo a este directorio (ej. `'schema.sql'`).
 * @returns {string[]} Los batches de SQL a ejecutar en orden, sin bloques vacíos.
 */
function readBatches(file) {
  return fs
    .readFileSync(path.join(__dirname, file), 'utf8')
    .split(/^\s*GO\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0)
    .filter(b => !/^\s*(USE\b|CREATE\s+DATABASE\b)/i.test(b));
}

/**
 * Ejecuta una lista de batches SQL en orden sobre el pool dado. Se detiene y
 * relanza el error en el primer batch que falle (identificando su índice),
 * para que quede claro qué sentencia del archivo causó el problema.
 * @param {import('mssql').ConnectionPool} pool Pool de conexión activo.
 * @param {string[]} batches Batches a ejecutar (ver {@link readBatches}).
 * @param {string} label Nombre descriptivo del archivo, usado solo en los mensajes de consola.
 * @throws Si algún batch falla al ejecutarse.
 */
async function runBatches(pool, batches, label) {
  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().query(batches[i]);
    } catch (err) {
      console.error(`  ✗ Error en bloque ${i + 1} de ${label}:`);
      console.error('  ', err.message);
      throw err;
    }
  }
  console.log(`  ✓ ${label} — ${batches.length} bloques ejecutados`);
}

/**
 * Bootstrap del superadmin inicial: crea el usuario `admin` (contraseña
 * `ADMIN_PASSWORD`) solo si la BD **no tiene ningún superadmin todavía**.
 * En una instalación ya establecida (que ya tiene su propio superadmin, ej.
 * `SOPORTEMILCIEN`) no crea nada, para no reintroducir en cada `setup` una
 * cuenta superadmin con contraseña por defecto. `ADMIN_PASSWORD` solo aplica
 * en el arranque de una BD vacía.
 * @param {import('mssql').ConnectionPool} pool Pool de conexión activo.
 */
async function createAdminIfNotExists(pool) {
  const exists = await pool.request().query(
    `SELECT 1 FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE r.nombre = 'superadmin'`
  );
  if (exists.recordset.length > 0) {
    console.log('   ✓ Ya existe un superadmin — sin cambios');
    return;
  }

  const hash  = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const rolId = await pool.request().query(
    `SELECT id FROM roles WHERE nombre = 'superadmin'`
  );

  const req = pool.request();
  req.input('hash',  sql.NVarChar, hash);
  req.input('rolId', sql.TinyInt,  rolId.recordset[0].id);
  await req.query(`
    INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo, registro_aprobado)
    VALUES ('admin', @hash, 'Administrador', @rolId, 1, 1)
  `);
  console.log(`   ✓ Usuario admin creado (contraseña: ${ADMIN_PASSWORD})`);
}

/**
 * Orquesta el setup completo de la base de datos: crea la BD si falta,
 * ejecuta schema y stored procedures, y asegura el usuario admin inicial.
 * Ver el resumen del módulo para el detalle de cada paso.
 */
async function main() {
  console.log('\n=== GCM Tickets — Setup de base de datos ===\n');

  // Paso 1: crear BD si no existe (conectar a master)
  console.log('1. Verificando base de datos...');
  const master = await sql.connect({ ...baseConfig, database: 'master' });
  await master.request().query(`
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${DB_NAME}')
      CREATE DATABASE [${DB_NAME}]
  `);
  await master.close();
  console.log(`   ✓ Base de datos '${DB_NAME}' lista`);

  // Paso 2: conectar a gcm_tickets
  const pool = await sql.connect({ ...baseConfig, database: DB_NAME });

  // Paso 3: tablas, seeds y migraciones
  console.log('\n2. Ejecutando schema.sql...');
  await runBatches(pool, readBatches('schema.sql'), 'schema.sql');

  // Paso 4: stored procedures
  console.log('\n3. Ejecutando procedimientos.sql...');
  await runBatches(pool, readBatches('procedimientos.sql'), 'procedimientos.sql');

  // Paso 5: usuario admin inicial
  console.log('\n4. Verificando usuario admin...');
  await createAdminIfNotExists(pool);

  await pool.close();
  console.log('\n✓ Setup completado. Arranca el servidor con:\n\n    npm run dev     (desarrollo)\n    npm run build && npm start   (produccion)\n');
}

main().catch(err => {
  console.error('\n✗ Setup fallido:', err.message);
  process.exit(1);
});
