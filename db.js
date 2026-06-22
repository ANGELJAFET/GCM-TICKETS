require('dotenv').config();
const sql    = require('mssql');
const bcrypt = require('bcrypt');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

const baseConfig = {
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'GcmApp@2024!',
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433'),
  options: {
    trustServerCertificate: true,
    encrypt: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool = null;

// Traduce sintaxis MySQL → T-SQL (SQL Server 2014)
function toTSQL(s) {
  return s
    // TRIM(CONCAT(x,' ',IFNULL(y,''))) → LTRIM(RTRIM(CONCAT(x,' ',ISNULL(y,''))))
    .replace(/TRIM\(CONCAT\(([^,]+),\s*' ',\s*IFNULL\(([^,]+),\s*''\)\)\)/g,
             "LTRIM(RTRIM(CONCAT($1,' ',ISNULL($2,''))))")
    .replace(/\bIFNULL\s*\(/gi,  'ISNULL(')
    .replace(/\bNOW\s*\(\)/gi,   'GETDATE()')
    .replace(/\bCURDATE\s*\(\)/gi, 'CAST(GETDATE() AS DATE)')
    .replace(/\bTRUE\b/g,  '1')
    .replace(/\bFALSE\b/g, '0');
}

// Ejecuta una query con parámetros posicionales (?)
// Los ? se convierten automáticamente en @p0, @p1, ...
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

async function runSQL(text) {
  await pool.request().query(text);
}

async function createSchema() {
  await runSQL(`
    IF OBJECT_ID('departamentos','U') IS NULL
    CREATE TABLE departamentos (
      id         INT IDENTITY(1,1) PRIMARY KEY,
      nombre     NVARCHAR(100)  NOT NULL,
      activo     BIT            NOT NULL DEFAULT 1,
      created_at DATETIME2      NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('contadores','U') IS NULL
    CREATE TABLE contadores (
      nombre NVARCHAR(50) PRIMARY KEY,
      valor  INT NOT NULL DEFAULT 0
    )`);

  // ── Tabla de roles (catálogo normalizado) ──────────────────────────────────
  await runSQL(`
    IF OBJECT_ID('roles','U') IS NULL
    CREATE TABLE roles (
      id          TINYINT IDENTITY(1,1) PRIMARY KEY,
      nombre      NVARCHAR(20)  NOT NULL,
      nivel       TINYINT       NOT NULL,
      descripcion NVARCHAR(200),
      CONSTRAINT UQ_roles_nombre UNIQUE (nombre)
    )`);

  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'empleado')
    INSERT INTO roles (nombre, nivel, descripcion) VALUES
      (N'empleado',   1, N'Portal empleados: crea y consulta sus tickets'),
      (N'tecnico',    2, N'Panel admin: gestiona tickets asignados'),
      (N'admin',      3, N'Panel admin: gestión completa del sistema'),
      (N'superadmin', 4, N'Panel admin: control total sin restricciones')`);

  // ── Tabla usuarios (instalaciones nuevas usan rol_id desde el inicio) ──────
  await runSQL(`
    IF OBJECT_ID('usuarios','U') IS NULL
    CREATE TABLE usuarios (
      id                    INT IDENTITY(1,1) PRIMARY KEY,
      username              NVARCHAR(100) NOT NULL,
      email                 NVARCHAR(255),
      password_hash         NVARCHAR(255),
      nombre                NVARCHAR(100) NOT NULL,
      apellido              NVARCHAR(100),
      telefono              NVARCHAR(20),
      departamento_id       INT     REFERENCES departamentos(id),
      rol_id                TINYINT NOT NULL DEFAULT 1 REFERENCES roles(id),
      activo                BIT     NOT NULL DEFAULT 1,
      registro_aprobado     BIT     NOT NULL DEFAULT 0,
      registro_aprobado_por INT,
      registro_aprobado_en  DATETIME2,
      created_by            INT,
      ultimo_login          DATETIME2,
      created_at            DATETIME2 NOT NULL DEFAULT GETDATE(),
      updated_at            DATETIME2,
      CONSTRAINT UQ_usuarios_username UNIQUE (username)
    )`);

  // ── Migración automática: rol TEXT → rol_id FK (solo si la BD ya existía) ──
  // Paso 1: añadir columna rol_id si falta
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol_id')
      EXEC('ALTER TABLE usuarios ADD rol_id TINYINT NULL')`);

  // Paso 2: poblar rol_id a partir del texto antiguo (usando EXEC para evitar
  //         que el parser falle si la columna 'rol' ya no existe)
  await runSQL(`
    IF EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol')
    BEGIN
      EXEC('UPDATE u SET u.rol_id = r.id FROM usuarios u JOIN roles r ON r.nombre = u.rol WHERE u.rol_id IS NULL');
      EXEC('UPDATE usuarios SET rol_id = 1 WHERE rol_id IS NULL');
    END`);

  // Paso 3: agregar DEFAULT 1 si no tiene ninguno
  await runSQL(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.default_constraints dc
      JOIN sys.columns c ON dc.parent_object_id = c.object_id
                        AND dc.parent_column_id  = c.column_id
      WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol_id'
    )
    EXEC('ALTER TABLE usuarios ADD DEFAULT 1 FOR rol_id')`);

  // Paso 4: convertir a NOT NULL si aún es nullable
  await runSQL(`
    IF EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol_id' AND is_nullable = 1)
      EXEC('ALTER TABLE usuarios ALTER COLUMN rol_id TINYINT NOT NULL')`);

  // Paso 5: agregar FK hacia roles si no existe ninguna en esa columna
  await runSQL(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys f
      JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
      JOIN sys.columns c ON fc.parent_object_id = c.object_id
                        AND fc.parent_column_id  = c.column_id
      WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol_id'
    )
    EXEC('ALTER TABLE usuarios ADD CONSTRAINT FK_usuarios_rol_id FOREIGN KEY (rol_id) REFERENCES roles(id)')`);

  // Paso 6: eliminar la columna antigua 'rol' (también su DEFAULT si lo tiene)
  await runSQL(`
    IF EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol')
    BEGIN
      DECLARE @con NVARCHAR(200);
      SELECT @con = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON dc.parent_object_id = c.object_id
                          AND dc.parent_column_id  = c.column_id
       WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol';
      IF @con IS NOT NULL EXEC('ALTER TABLE usuarios DROP CONSTRAINT ' + @con);
      EXEC('ALTER TABLE usuarios DROP COLUMN rol');
    END`);

  // Email único solo cuando no es NULL (SQL Server no permite múltiples NULL en UNIQUE constraint)
  await runSQL(`
    IF EXISTS (SELECT 1 FROM sys.key_constraints
               WHERE name = 'UQ_usuarios_email'
                 AND parent_object_id = OBJECT_ID('usuarios'))
      ALTER TABLE usuarios DROP CONSTRAINT UQ_usuarios_email`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'IX_usuarios_email'
                     AND object_id = OBJECT_ID('usuarios'))
      CREATE UNIQUE INDEX IX_usuarios_email ON usuarios(email) WHERE email IS NOT NULL`);

  await runSQL(`
    IF OBJECT_ID('dispositivos','U') IS NULL
    CREATE TABLE dispositivos (
      id             NVARCHAR(20)  PRIMARY KEY,
      ticket_id      NVARCHAR(20),
      tipo           NVARCHAR(100) NOT NULL,
      marca          NVARCHAR(100) NOT NULL,
      modelo         NVARCHAR(100),
      numero_serie   NVARCHAR(200),
      estado_fisico  NVARCHAR(20)  DEFAULT 'bueno',
      falla_cliente  NVARCHAR(MAX),
      accesorios     NVARCHAR(MAX),
      cliente_nombre NVARCHAR(200),
      cliente_tel    NVARCHAR(50),
      tecnico_id     INT REFERENCES usuarios(id),
      created_at     DATETIME2     NOT NULL DEFAULT GETDATE(),
      updated_at     DATETIME2
    )`);

  await runSQL(`
    IF OBJECT_ID('tickets','U') IS NULL
    CREATE TABLE tickets (
      id              NVARCHAR(20)  PRIMARY KEY,
      titulo          NVARCHAR(500) NOT NULL,
      descripcion     NVARCHAR(MAX),
      status          NVARCHAR(20)  NOT NULL DEFAULT 'abierto',
      prioridad       NVARCHAR(20)  NOT NULL DEFAULT 'Media',
      categoria       NVARCHAR(50)  NOT NULL DEFAULT 'Otro',
      reporter_nombre NVARCHAR(200),
      asignado_id     INT REFERENCES usuarios(id),
      device_id       NVARCHAR(20),
      created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
      updated_at      DATETIME2,
      closed_at       DATETIME2
    )`);

  await runSQL(`
    IF OBJECT_ID('comentarios','U') IS NULL
    CREATE TABLE comentarios (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      ticket_id    NVARCHAR(20)  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      autor_nombre NVARCHAR(200),
      texto        NVARCHAR(MAX) NOT NULL,
      es_interno   BIT           NOT NULL DEFAULT 0,
      created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('historial_tickets','U') IS NULL
    CREATE TABLE historial_tickets (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      ticket_id        NVARCHAR(20)  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      usuario_nombre   NVARCHAR(200),
      accion           NVARCHAR(500),
      campo_modificado NVARCHAR(100),
      valor_anterior   NVARCHAR(500),
      valor_nuevo      NVARCHAR(500),
      created_at       DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('adjuntos','U') IS NULL
    CREATE TABLE adjuntos (
      id              INT IDENTITY(1,1) PRIMARY KEY,
      ticket_id       NVARCHAR(20)  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      nombre_original NVARCHAR(500),
      nombre_archivo  NVARCHAR(500),
      ruta            NVARCHAR(500),
      tipo_mime       NVARCHAR(100),
      tamano_bytes    BIGINT,
      created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('inventario','U') IS NULL
    CREATE TABLE inventario (
      id             NVARCHAR(20)  PRIMARY KEY,
      tipo           NVARCHAR(100) NOT NULL,
      marca          NVARCHAR(100) NOT NULL,
      modelo         NVARCHAR(100),
      numero_serie   NVARCHAR(200),
      color          NVARCHAR(100),
      condicion      NVARCHAR(20)  DEFAULT 'bueno',
      estado         NVARCHAR(20)  DEFAULT 'disponible',
      ubicacion      NVARCHAR(200),
      responsable_id INT REFERENCES usuarios(id),
      notas          NVARCHAR(MAX),
      garantia       NVARCHAR(500),
      fecha_ingreso  DATE,
      created_at     DATETIME2     NOT NULL DEFAULT GETDATE(),
      updated_at     DATETIME2
    )`);

  await runSQL(`
    IF OBJECT_ID('historial_inventario','U') IS NULL
    CREATE TABLE historial_inventario (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      inventario_id NVARCHAR(20)  NOT NULL REFERENCES inventario(id),
      usuario_id    INT REFERENCES usuarios(id),
      accion        NVARCHAR(500),
      created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('prestamos','U') IS NULL
    CREATE TABLE prestamos (
      id                        NVARCHAR(20)  PRIMARY KEY,
      inventario_id             NVARCHAR(20)  NOT NULL REFERENCES inventario(id),
      empleado_id               INT REFERENCES usuarios(id),
      empleado_nombre           NVARCHAR(200),
      departamento              NVARCHAR(100),
      fecha_prestamo            DATETIME2     NOT NULL DEFAULT GETDATE(),
      fecha_devolucion_estimada DATE,
      fecha_devolucion_real     DATETIME2,
      estado                    NVARCHAR(20)  DEFAULT 'activo',
      autorizado_por_id         INT REFERENCES usuarios(id),
      notas                     NVARCHAR(MAX),
      created_at                DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  await runSQL(`
    IF OBJECT_ID('solicitudes_registro','U') IS NULL
    CREATE TABLE solicitudes_registro (
      id              INT IDENTITY(1,1) PRIMARY KEY,
      nombre          NVARCHAR(100) NOT NULL,
      apellido        NVARCHAR(100),
      email           NVARCHAR(255),
      username        NVARCHAR(100) NOT NULL,
      password_hash   NVARCHAR(255),
      telefono        NVARCHAR(20),
      departamento_id INT REFERENCES departamentos(id),
      mensaje         NVARCHAR(MAX),
      estado          NVARCHAR(20)  NOT NULL DEFAULT 'pendiente',
      revisado_por    INT REFERENCES usuarios(id),
      revisado_en     DATETIME2,
      motivo_rechazo  NVARCHAR(500),
      created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
    )`);

  // Departamentos por defecto
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM departamentos WHERE nombre = 'Sistemas / TI')
    INSERT INTO departamentos (nombre) VALUES
      (N'Sistemas / TI'),(N'Administración'),(N'Recursos Humanos'),
      (N'Contabilidad'),(N'Ventas'),(N'Operaciones'),(N'Gerencia')`);

  // Contadores por defecto
  await runSQL(`IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre='tickets')       INSERT INTO contadores VALUES('tickets',0)`);
  await runSQL(`IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre='dispositivos')  INSERT INTO contadores VALUES('dispositivos',0)`);
  await runSQL(`IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre='inventario')    INSERT INTO contadores VALUES('inventario',0)`);
  await runSQL(`IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre='prestamos')     INSERT INTO contadores VALUES('prestamos',0)`);

  // Departamento libre en solicitudes (texto que el usuario escribe)
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'departamento_nombre')
      ALTER TABLE solicitudes_registro ADD departamento_nombre NVARCHAR(255) NULL`);

  // Columnas de aprobación de registro (agregadas en versión 2)
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado')
      ALTER TABLE usuarios ADD registro_aprobado BIT NOT NULL DEFAULT 0`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado_por')
      ALTER TABLE usuarios ADD registro_aprobado_por INT NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado_en')
      ALTER TABLE usuarios ADD registro_aprobado_en DATETIME2 NULL`);

  // Columnas del perfil de usuario (pueden faltar en BDs antiguas)
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'email')
      ALTER TABLE usuarios ADD email NVARCHAR(255) NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'apellido')
      ALTER TABLE usuarios ADD apellido NVARCHAR(100) NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'telefono')
      ALTER TABLE usuarios ADD telefono NVARCHAR(20) NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'departamento_id')
      ALTER TABLE usuarios ADD departamento_id INT NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'created_by')
      ALTER TABLE usuarios ADD created_by INT NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'ultimo_login')
      ALTER TABLE usuarios ADD ultimo_login DATETIME2 NULL`);
  await runSQL(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('usuarios') AND name = 'updated_at')
      ALTER TABLE usuarios ADD updated_at DATETIME2 NULL`);

  // ── Tabla de auditoría ────────────────────────────────────────────────────
  await runSQL(`
    IF OBJECT_ID('auditoria','U') IS NULL
    CREATE TABLE auditoria (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      fecha        DATETIME2 NOT NULL DEFAULT GETDATE(),
      actor        NVARCHAR(150),
      accion       NVARCHAR(300) NOT NULL,
      entidad      NVARCHAR(50),
      entidad_id   NVARCHAR(50),
      detalle      NVARCHAR(MAX)
    )`);
}

async function initDB() {
  try {
    // Conectar a master para crear la BD si no existe
    const masterPool = new sql.ConnectionPool({ ...baseConfig, database: 'master' });
    await masterPool.connect();
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'gcm_tickets')
        CREATE DATABASE [gcm_tickets]`);
    await masterPool.close();

    // Conectar a gcm_tickets
    pool = new sql.ConnectionPool({ ...baseConfig, database: process.env.DB_NAME || 'gcm_tickets' });
    await pool.connect();
    console.log('✓ Conexión SQL Server establecida.');

    // Crear / migrar esquema
    await createSchema();

  } catch (err) {
    console.error('✗ Error SQL Server:', err.message);
    console.error('  Asegúrate de haber reiniciado el servicio SQL Server (ver instrucciones).');
    process.exit(1);
  }
}

module.exports = { pool, query, queryOne, nextId, isAdmin, findUserByNombre, initDB, bcrypt, ROUNDS };
