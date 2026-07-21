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

// Divide el archivo .sql en batches separados por GO
// Omite USE y CREATE DATABASE — la conexión ya apunta a la BD correcta
function readBatches(file) {
  return fs
    .readFileSync(path.join(__dirname, file), 'utf8')
    .split(/^\s*GO\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0)
    .filter(b => !/^\s*(USE\b|CREATE\s+DATABASE\b)/i.test(b));
}

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

async function createAdminIfNotExists(pool) {
  const exists = await pool.request().query(
    `SELECT 1 FROM usuarios WHERE username = 'admin'`
  );
  if (exists.recordset.length > 0) {
    console.log('   ✓ Usuario admin ya existe — sin cambios');
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
