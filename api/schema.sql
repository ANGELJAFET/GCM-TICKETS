-- ============================================================
--  GCM Tickets — Script de despliegue de base de datos
--  Motor : SQL Server 2014 o superior
--  Uso   : Ejecutar en SSMS (Abrir archivo → F5)
--          o mediante sqlcmd antes de lanzar la aplicación.
--
--  El script es idempotente: se puede ejecutar varias veces
--  sin pérdida de datos (usa IF NOT EXISTS / IF OBJECT_ID).
--
--  Tras ejecutar este script, inicia la app con:
--      node server.js
--  El usuario admin se crea automáticamente al primer arranque.
-- ============================================================
--
--  Modelo de datos — resumen de entidades y relaciones (FK):
--
--    roles 1───* usuarios *───1 departamentos
--    usuarios 1───* tickets (reporter_id, asignado_id)
--    tickets 1───* comentarios / historial_tickets / adjuntos  (ON DELETE CASCADE)
--    tickets 1───1 dispositivos (device_id — equipo recibido en taller)
--    usuarios 1───* dispositivos (tecnico_id)
--    usuarios 1───* inventario (responsable_id)
--    inventario 1───* historial_inventario
--    inventario 1───* prestamos *───1 usuarios (empleado_id, autorizado_por_id)
--    solicitudes_registro *───1 usuarios (revisado_por) — se aprueba/rechaza
--      y, si se aprueba, genera una fila nueva en usuarios (no hay FK directa
--      solicitud→usuario porque la cuenta aún no existe al crear la solicitud)
--    contadores — no tiene FKs; solo guarda el último correlativo usado por
--      db.nextId() para generar IDs legibles (TK-001, INV-001, PREST-001, DEV-001)
--    auditoria — tabla de bitácora, sin FKs (actor/entidad quedan como texto
--      para que un registro de auditoría sobreviva aunque el usuario o la
--      entidad referenciada se elimine después)
--
--  Convención de claves: catálogos pequeños (roles, departamentos, contadores)
--  usan INT/TINYINT autoincremental; las entidades de negocio (tickets,
--  inventario, prestamos, dispositivos) usan NVARCHAR con folio legible
--  generado por db.nextId() (ver api/src/db.ts).
-- ============================================================

-- ============================================================
-- 1.  Base de datos
-- ============================================================
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'gcm_tickets')
  CREATE DATABASE [gcm_tickets];
GO

USE [gcm_tickets];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- 2.  Tablas (orden respeta dependencias FK)
-- ============================================================

-- ------------------------------------------------------------
-- 2.1  departamentos
-- ------------------------------------------------------------
IF OBJECT_ID('departamentos','U') IS NULL
CREATE TABLE departamentos (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  nombre     NVARCHAR(100) NOT NULL,
  activo     BIT           NOT NULL DEFAULT 1,
  created_at DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.2  contadores  (secuencias personalizadas para IDs)
-- ------------------------------------------------------------
IF OBJECT_ID('contadores','U') IS NULL
CREATE TABLE contadores (
  nombre NVARCHAR(50) PRIMARY KEY,
  valor  INT NOT NULL DEFAULT 0
);
GO

-- ------------------------------------------------------------
-- 2.3  roles  (catálogo normalizado de roles de usuario)
-- ------------------------------------------------------------
IF OBJECT_ID('roles','U') IS NULL
CREATE TABLE roles (
  id          TINYINT IDENTITY(1,1) PRIMARY KEY,
  nombre      NVARCHAR(20)  NOT NULL,
  nivel       TINYINT       NOT NULL,   -- 1=empleado 2=tecnico 3=admin 4=superadmin
  descripcion NVARCHAR(200),
  CONSTRAINT UQ_roles_nombre UNIQUE (nombre)
);
GO

-- ------------------------------------------------------------
-- 2.4  usuarios
-- ------------------------------------------------------------
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
  ultimo_login          DATETIME2,
  created_at            DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at            DATETIME2,
  CONSTRAINT UQ_usuarios_username UNIQUE (username)
);
GO

-- Índice único en email (permite varios NULL)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_usuarios_email' AND object_id = OBJECT_ID('usuarios')
)
  CREATE UNIQUE INDEX IX_usuarios_email ON usuarios(email) WHERE email IS NOT NULL;
GO

-- ------------------------------------------------------------
-- 2.5  dispositivos  (equipos recibidos en taller)
-- ------------------------------------------------------------
IF OBJECT_ID('dispositivos','U') IS NULL
CREATE TABLE dispositivos (
  id             NVARCHAR(20)  PRIMARY KEY,
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
);
GO

-- ------------------------------------------------------------
-- 2.6  tickets
-- ------------------------------------------------------------
IF OBJECT_ID('tickets','U') IS NULL
CREATE TABLE tickets (
  id              NVARCHAR(20)  PRIMARY KEY,
  titulo          NVARCHAR(500) NOT NULL,
  descripcion     NVARCHAR(MAX),
  status          NVARCHAR(20)  NOT NULL DEFAULT 'abierto',
  prioridad       NVARCHAR(20)  NOT NULL DEFAULT 'Media',
  categoria       NVARCHAR(50)  NOT NULL DEFAULT 'Otro',
  reporter_id     INT REFERENCES usuarios(id),
  reporter_nombre NVARCHAR(200),
  asignado_id     INT REFERENCES usuarios(id),
  device_id       NVARCHAR(20) REFERENCES dispositivos(id),
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME2,
  closed_at       DATETIME2
);
GO

-- ------------------------------------------------------------
-- 2.7  comentarios
-- ------------------------------------------------------------
IF OBJECT_ID('comentarios','U') IS NULL
CREATE TABLE comentarios (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  ticket_id    NVARCHAR(20)  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  autor_id     INT REFERENCES usuarios(id),
  autor_nombre NVARCHAR(200),
  texto        NVARCHAR(MAX) NOT NULL,
  es_interno   BIT           NOT NULL DEFAULT 0,
  created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.8  historial_tickets
-- ------------------------------------------------------------
IF OBJECT_ID('historial_tickets','U') IS NULL
CREATE TABLE historial_tickets (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  ticket_id        NVARCHAR(20)  NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  usuario_id       INT REFERENCES usuarios(id),
  usuario_nombre   NVARCHAR(200),
  accion           NVARCHAR(500),
  campo_modificado NVARCHAR(100),
  valor_anterior   NVARCHAR(500),
  valor_nuevo      NVARCHAR(500),
  created_at       DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.9  adjuntos  (archivos adjuntos a tickets)
-- ------------------------------------------------------------
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
);
GO

-- ------------------------------------------------------------
-- 2.10  inventario  (equipos del inventario TI)
-- ------------------------------------------------------------
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
  foto           NVARCHAR(500),
  fecha_ingreso  DATE,
  created_at     DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at     DATETIME2
);
GO

-- ------------------------------------------------------------
-- 2.11  historial_inventario
-- ------------------------------------------------------------
IF OBJECT_ID('historial_inventario','U') IS NULL
CREATE TABLE historial_inventario (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  inventario_id NVARCHAR(20)  NOT NULL REFERENCES inventario(id),
  usuario_id    INT REFERENCES usuarios(id),
  accion        NVARCHAR(500),
  created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.12  prestamos
-- ------------------------------------------------------------
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
);
GO

-- ------------------------------------------------------------
-- 2.13  solicitudes_registro  (peticiones de acceso de empleados)
-- ------------------------------------------------------------
IF OBJECT_ID('solicitudes_registro','U') IS NULL
CREATE TABLE solicitudes_registro (
  id                   INT IDENTITY(1,1) PRIMARY KEY,
  nombre               NVARCHAR(100) NOT NULL,
  apellido             NVARCHAR(100),
  email                NVARCHAR(255),
  username             NVARCHAR(100) NOT NULL,
  password_hash        NVARCHAR(255),
  telefono             NVARCHAR(20),
  departamento_nombre  NVARCHAR(255) NULL,
  mensaje              NVARCHAR(MAX),
  estado               NVARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  revisado_por         INT REFERENCES usuarios(id),
  revisado_en          DATETIME2,
  motivo_rechazo       NVARCHAR(500),
  created_at           DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- ------------------------------------------------------------
-- 2.14  auditoria  (bitácora de acciones administrativas)
-- ------------------------------------------------------------
IF OBJECT_ID('auditoria','U') IS NULL
CREATE TABLE auditoria (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  fecha        DATETIME2    NOT NULL DEFAULT GETDATE(),
  actor        NVARCHAR(150),
  accion       NVARCHAR(300) NOT NULL,
  entidad      NVARCHAR(50),
  entidad_id   NVARCHAR(50),
  detalle      NVARCHAR(MAX)
);
GO

-- ============================================================
-- 3.  Datos iniciales (seeds)
-- ============================================================

-- Roles (requerido antes de insertar usuarios)
IF NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'empleado')
  INSERT INTO roles (nombre, nivel, descripcion) VALUES
    (N'empleado',   1, N'Portal empleados: crea y consulta sus tickets'),
    (N'tecnico',    2, N'Panel admin: gestiona tickets asignados'),
    (N'admin',      3, N'Panel admin: gestión completa del sistema'),
    (N'superadmin', 4, N'Panel admin: control total sin restricciones');
GO

-- Departamentos
IF NOT EXISTS (SELECT 1 FROM departamentos WHERE nombre = N'Sistemas / TI')
  INSERT INTO departamentos (nombre) VALUES
    (N'Sistemas / TI'),
    (N'Administración'),
    (N'Recursos Humanos'),
    (N'Contabilidad'),
    (N'Ventas'),
    (N'Operaciones'),
    (N'Gerencia');
GO

-- Contadores de secuencia
IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'tickets')      INSERT INTO contadores VALUES ('tickets',      0);
IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'dispositivos') INSERT INTO contadores VALUES ('dispositivos', 0);
IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'inventario')   INSERT INTO contadores VALUES ('inventario',   0);
IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'prestamos')    INSERT INTO contadores VALUES ('prestamos',    0);
IF NOT EXISTS (SELECT 1 FROM contadores WHERE nombre = 'grupos')       INSERT INTO contadores VALUES ('grupos',       0);
GO

-- ============================================================
-- 4.  Migración: rol TEXT → rol_id FK  (solo BDs antiguas)
--     Si la BD ya tiene rol_id estas sentencias no hacen nada.
-- ============================================================

-- 4.1  Añadir columna rol_id si aún no existe
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol_id'
)
  ALTER TABLE usuarios ADD rol_id TINYINT NULL;
GO

-- 4.2  Poblar rol_id desde el texto antiguo
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol'
)
BEGIN
  EXEC('UPDATE u SET u.rol_id = r.id FROM usuarios u JOIN roles r ON r.nombre = u.rol WHERE u.rol_id IS NULL');
  EXEC('UPDATE usuarios SET rol_id = 1 WHERE rol_id IS NULL');
END
GO

-- 4.3  DEFAULT 1 para rol_id
IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints dc
  JOIN sys.columns c ON dc.parent_object_id = c.object_id
                    AND dc.parent_column_id  = c.column_id
  WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol_id'
)
  ALTER TABLE usuarios ADD DEFAULT 1 FOR rol_id;
GO

-- 4.4  Hacer NOT NULL
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol_id' AND is_nullable = 1
)
  ALTER TABLE usuarios ALTER COLUMN rol_id TINYINT NOT NULL;
GO

-- 4.5  FK hacia roles (si no existe ninguna en esa columna)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys f
  JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
  JOIN sys.columns c ON fc.parent_object_id = c.object_id
                    AND fc.parent_column_id  = c.column_id
  WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol_id'
)
  ALTER TABLE usuarios ADD CONSTRAINT FK_usuarios_rol_id
    FOREIGN KEY (rol_id) REFERENCES roles(id);
GO

-- 4.6  Eliminar columna antigua 'rol'
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('usuarios') AND name = 'rol'
)
BEGIN
  DECLARE @con NVARCHAR(200);
  SELECT @con = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id
                      AND dc.parent_column_id  = c.column_id
   WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'rol';
  IF @con IS NOT NULL EXEC('ALTER TABLE usuarios DROP CONSTRAINT ' + @con);
  ALTER TABLE usuarios DROP COLUMN rol;
END
GO

-- ============================================================
-- 5.  Migraciones de columnas (solo BDs antiguas)
--     En instalaciones nuevas estas columnas ya existen.
-- ============================================================

-- usuarios: columnas de aprobación (v2)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado')
  ALTER TABLE usuarios ADD registro_aprobado BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado_por')
  ALTER TABLE usuarios ADD registro_aprobado_por INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'registro_aprobado_en')
  ALTER TABLE usuarios ADD registro_aprobado_en DATETIME2 NULL;
GO

-- usuarios: columnas de perfil
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'email')
  ALTER TABLE usuarios ADD email NVARCHAR(255) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'apellido')
  ALTER TABLE usuarios ADD apellido NVARCHAR(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'telefono')
  ALTER TABLE usuarios ADD telefono NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'departamento_id')
  ALTER TABLE usuarios ADD departamento_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'created_by')
  ALTER TABLE usuarios ADD created_by INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'ultimo_login')
  ALTER TABLE usuarios ADD ultimo_login DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'updated_at')
  ALTER TABLE usuarios ADD updated_at DATETIME2 NULL;
GO

-- Índice único en email que permite múltiples NULL
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_usuarios_email' AND parent_object_id = OBJECT_ID('usuarios'))
  ALTER TABLE usuarios DROP CONSTRAINT UQ_usuarios_email;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_usuarios_email' AND object_id = OBJECT_ID('usuarios'))
  CREATE UNIQUE INDEX IX_usuarios_email ON usuarios(email) WHERE email IS NOT NULL;
GO

-- solicitudes_registro: columna de departamento en texto libre
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'departamento_nombre')
  ALTER TABLE solicitudes_registro ADD departamento_nombre NVARCHAR(255) NULL;
GO

-- Usuarios activos que quedaron con registro_aprobado = 0 (flujo antiguo de email)
-- Se aprueban automáticamente ya que están activos y son usuarios legítimos
UPDATE usuarios SET registro_aprobado = 1
WHERE activo = 1 AND registro_aprobado = 0;
GO

-- email_verificado: columna eliminada (ya no se usa verificación por correo)
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('usuarios') AND name = 'email_verificado')
BEGIN
  DECLARE @defEV NVARCHAR(200);
  SELECT @defEV = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id
                      AND dc.parent_column_id  = c.column_id
   WHERE c.object_id = OBJECT_ID('usuarios') AND c.name = 'email_verificado';
  IF @defEV IS NOT NULL EXEC('ALTER TABLE usuarios DROP CONSTRAINT ' + @defEV);
  ALTER TABLE usuarios DROP COLUMN email_verificado;
END;
GO

-- usuarios.created_by: nunca se asigna en ningún flujo del sistema
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('usuarios') AND name = 'created_by')
  ALTER TABLE usuarios DROP COLUMN created_by;
GO

-- solicitudes_registro.departamento_id: siempre NULL; el sistema usa departamento_nombre
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'departamento_id')
BEGIN
  DECLARE @fkDept NVARCHAR(200);
  SELECT @fkDept = f.name
    FROM sys.foreign_keys f
    JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
    JOIN sys.columns c ON fc.parent_object_id = c.object_id
                      AND fc.parent_column_id  = c.column_id
   WHERE c.object_id = OBJECT_ID('solicitudes_registro') AND c.name = 'departamento_id';
  IF @fkDept IS NOT NULL EXEC('ALTER TABLE solicitudes_registro DROP CONSTRAINT ' + @fkDept);
  ALTER TABLE solicitudes_registro DROP COLUMN departamento_id;
END;
GO

-- email_verify_token / email_verify_deadline: columnas huérfanas de versión anterior
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('usuarios') AND name = 'email_verify_token')
  ALTER TABLE usuarios DROP COLUMN email_verify_token;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('usuarios') AND name = 'email_verify_deadline')
  ALTER TABLE usuarios DROP COLUMN email_verify_deadline;
GO

-- ============================================================
-- 6.  Normalización: relación 1:1 dispositivos↔tickets
--     Antes se guardaba en ambas tablas (dispositivos.ticket_id
--     Y tickets.device_id) sin FK real en ninguna. Se deja una
--     sola dirección (tickets.device_id) con FK real.
-- ============================================================

-- 6.1  Eliminar dispositivos.ticket_id (redundante, sin FK, no usado)
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dispositivos') AND name = 'ticket_id')
  ALTER TABLE dispositivos DROP COLUMN ticket_id;
GO

-- 6.2  Añadir FK real en tickets.device_id → dispositivos(id)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys f
  JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
  JOIN sys.columns c ON fc.parent_object_id = c.object_id
                    AND fc.parent_column_id  = c.column_id
  WHERE c.object_id = OBJECT_ID('tickets') AND c.name = 'device_id'
)
  ALTER TABLE tickets ADD CONSTRAINT FK_tickets_device_id
    FOREIGN KEY (device_id) REFERENCES dispositivos(id);
GO

-- ============================================================
-- 7.  Normalización: reporter_id / autor_id / usuario_id
--     Login ahora es obligatorio, así que cada ticket/comentario/
--     entrada de historial creado desde la app queda ligado a un
--     usuarios.id real. Las columnas *_nombre se conservan como
--     respaldo de solo lectura para filas históricas que no
--     puedan resolverse a un usuario (ej. 'Sistema', nombres que
--     ya no existen). El backend nunca vuelve a escribir en ellas.
-- ============================================================

-- 7.1  tickets.reporter_id
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('tickets') AND name = 'reporter_id')
  ALTER TABLE tickets ADD reporter_id INT NULL REFERENCES usuarios(id);
GO

UPDATE t SET t.reporter_id = u.id
FROM tickets t
JOIN usuarios u ON LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) = LTRIM(RTRIM(t.reporter_nombre))
                 OR u.username = LTRIM(RTRIM(t.reporter_nombre))
WHERE t.reporter_id IS NULL AND t.reporter_nombre IS NOT NULL;
GO

-- 7.2  comentarios.autor_id
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('comentarios') AND name = 'autor_id')
  ALTER TABLE comentarios ADD autor_id INT NULL REFERENCES usuarios(id);
GO

UPDATE c SET c.autor_id = u.id
FROM comentarios c
JOIN usuarios u ON LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) = LTRIM(RTRIM(c.autor_nombre))
                 OR u.username = LTRIM(RTRIM(c.autor_nombre))
WHERE c.autor_id IS NULL AND c.autor_nombre IS NOT NULL;
GO

-- 7.3  historial_tickets.usuario_id
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('historial_tickets') AND name = 'usuario_id')
  ALTER TABLE historial_tickets ADD usuario_id INT NULL REFERENCES usuarios(id);
GO

UPDATE h SET h.usuario_id = u.id
FROM historial_tickets h
JOIN usuarios u ON LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) = LTRIM(RTRIM(h.usuario_nombre))
                 OR u.username = LTRIM(RTRIM(h.usuario_nombre))
WHERE h.usuario_id IS NULL AND h.usuario_nombre IS NOT NULL;
GO

-- ============================================================
-- 8. Acceso avanzado por módulo (inventario, préstamos, bitácora,
--    solicitudes, usuarios). Por defecto solo el rol superadmin
--    (nivel 4) puede usar estas secciones. Un admin/técnico
--    (nivel < 4) solo obtiene acceso al módulo si el superadmin
--    se lo otorga. El módulo 'usuarios' controla la visibilidad
--    del listado "Usuarios registrados" (datos personales de otros
--    usuarios); el cambio de contraseña queda reservado al
--    superadmin sin importar este permiso (ver PATCH /usuarios/:id/password).
-- ============================================================

-- Columna previa (interruptor único para los 4 módulos juntos) —
-- reemplazada por permisos independientes por módulo.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_avanzado')
BEGIN
  DECLARE @defAcc NVARCHAR(200) = (
    SELECT dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE dc.parent_object_id = OBJECT_ID('usuarios') AND c.name = 'acceso_avanzado'
  );
  IF @defAcc IS NOT NULL EXEC('ALTER TABLE usuarios DROP CONSTRAINT ' + @defAcc);
  ALTER TABLE usuarios DROP COLUMN acceso_avanzado;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_inventario')
  ALTER TABLE usuarios ADD acceso_inventario BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_prestamos')
  ALTER TABLE usuarios ADD acceso_prestamos BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_bitacora')
  ALTER TABLE usuarios ADD acceso_bitacora BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_solicitudes')
  ALTER TABLE usuarios ADD acceso_solicitudes BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'acceso_usuarios')
  ALTER TABLE usuarios ADD acceso_usuarios BIT NOT NULL DEFAULT 0;
GO

-- ============================================================
-- 9. Finca y área (registro de empleados)
--    'finca' es una de las 8 fincas fijas de la empresa o el valor
--    'No aplica' para quien no trabaja en una finca (validado en la
--    app, ver FINCAS en src/routes/auth.js). 'area' es texto libre.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'finca')
  ALTER TABLE solicitudes_registro ADD finca NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'area')
  ALTER TABLE solicitudes_registro ADD area NVARCHAR(255) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'finca')
  ALTER TABLE usuarios ADD finca NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'area')
  ALTER TABLE usuarios ADD area NVARCHAR(255) NULL;
GO

-- ============================================================
-- 9.1 AnyDesk (registro de empleados)
--    ID de AnyDesk del equipo del empleado, obligatorio en la solicitud
--    de acceso (validado en la app, ver src/routes/auth.ts). Se copia a
--    usuarios al aprobar y se muestra en el panel admin (detalle de usuario
--    y solicitudes) para dar soporte remoto.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('solicitudes_registro') AND name = 'anydesk')
  ALTER TABLE solicitudes_registro ADD anydesk NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuarios') AND name = 'anydesk')
  ALTER TABLE usuarios ADD anydesk NVARCHAR(50) NULL;
GO

-- ============================================================
-- 10. Inventario por cantidad (lotes: cables, mouse, etc.)
--     inventario.tipo_manejo: 'unidad' (default, número de serie
--     obligatorio, 1 fila = 1 unidad física) | 'cantidad' (lote sin
--     serie individual, cantidad_total unidades). La disponibilidad
--     de un ítem 'cantidad' se calcula como
--     cantidad_total - SUM(prestamos.cantidad - prestamos.cantidad_devuelta)
--     de sus préstamos activos — no se guarda como columna aparte
--     para evitar desincronización.
--     prestamos.cantidad/cantidad_devuelta permiten devolución
--     parcial; para equipos 'unidad' siempre es 1/0 o 1/1 (igual
--     que el comportamiento anterior, sin cambios).
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventario') AND name = 'tipo_manejo')
  ALTER TABLE inventario ADD tipo_manejo NVARCHAR(20) NOT NULL DEFAULT 'unidad';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventario') AND name = 'cantidad_total')
  ALTER TABLE inventario ADD cantidad_total INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'cantidad')
  ALTER TABLE prestamos ADD cantidad INT NOT NULL DEFAULT 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'cantidad_devuelta')
  ALTER TABLE prestamos ADD cantidad_devuelta INT NOT NULL DEFAULT 0;
GO

-- ============================================================
-- 11. Foto del equipo (inventario)
--     Ruta relativa (/uploads/archivo.ext) de una foto opcional del
--     equipo, capturada desde el navegador o desde el celular vía el
--     mismo mecanismo de sesión temporal + QR que usan los tickets.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('inventario') AND name = 'foto')
  ALTER TABLE inventario ADD foto NVARCHAR(500) NULL;
GO

-- ============================================================
-- 12. Comprobante de devolución
--     Condición del equipo y nota opcional capturadas al momento de
--     devolver un préstamo (parcial o total) — usadas para generar el
--     comprobante de devolución exportable, distinto del comprobante de
--     préstamo (generateLoanWord.ts / generateReturnWord.ts en el frontend).
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'condicion_devolucion')
  ALTER TABLE prestamos ADD condicion_devolucion NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'nota_devolucion')
  ALTER TABLE prestamos ADD nota_devolucion NVARCHAR(500) NULL;
GO

-- ============================================================
-- 13. Fotos de entrega del préstamo
--     Arreglo JSON de rutas (/uploads/archivo.ext) con las fotos del
--     estado del equipo al momento de entregarlo en préstamo, tomadas
--     desde el celular vía el mismo mecanismo de sesión temporal + QR
--     que la foto de inventario (varias fotos por sesión). Se incrustan
--     en el comprobante de préstamo (generateLoanWord.ts).
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'fotos_entrega')
  ALTER TABLE prestamos ADD fotos_entrega NVARCHAR(MAX) NULL;
GO

-- ============================================================
-- 14. Préstamos agrupados (varios equipos distintos en un mismo comprobante)
--     grupo_id enlaza los préstamos entregados juntos a la misma persona
--     (ej. laptop + mouse + teclado). Es NULL para préstamos de un solo
--     equipo (comportamiento anterior). El correlativo lo genera db.nextId
--     con el contador 'grupos' (GRP-001, GRP-002, ...). Cada equipo sigue
--     siendo una fila propia en 'prestamos' (con su cantidad y devolución),
--     así que la disponibilidad y el historial no cambian; grupo_id solo
--     agrupa para el comprobante y la devolución conjunta.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'grupo_id')
  ALTER TABLE prestamos ADD grupo_id NVARCHAR(20) NULL;
GO

-- ============================================================
-- 15. Asignación permanente (préstamo sin fecha de devolución)
--     permanente = 1 marca equipos entregados de forma indefinida a una
--     persona (no se espera devolución, no cuenta como "vencido"). En ese
--     caso fecha_devolucion_estimada queda NULL. Sigue pudiendo "devolverse"
--     (liberarse) si algún día se reasigna.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('prestamos') AND name = 'permanente')
  ALTER TABLE prestamos ADD permanente BIT NOT NULL DEFAULT 0;
GO

-- ============================================================
-- 16. Normalización / integridad (cambios aditivos, sin impacto en el backend)
--     Auditoría 2026-08: se agregan índices en FKs/filtros, una FK faltante,
--     índices UNIQUE (departamento sin duplicados, serie única por equipo de
--     unidad) y CHECKs de dominio cerrado. Los CHECK/FK usan WITH NOCHECK para
--     no fallar contra filas históricas: solo validan filas nuevas. Los valores
--     de los CHECK provienen de los enums que ya usa la app (no cambia nada de
--     comportamiento; solo impiden datos fuera de dominio a nivel de BD).
-- ============================================================

-- 16.1  Índices en claves foráneas y columnas de filtro frecuentes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_tickets_asignado_id'   AND object_id=OBJECT_ID('tickets'))            CREATE INDEX IX_tickets_asignado_id   ON tickets(asignado_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_tickets_reporter_id'   AND object_id=OBJECT_ID('tickets'))            CREATE INDEX IX_tickets_reporter_id   ON tickets(reporter_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_tickets_status'        AND object_id=OBJECT_ID('tickets'))            CREATE INDEX IX_tickets_status        ON tickets(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_comentarios_ticket_id' AND object_id=OBJECT_ID('comentarios'))        CREATE INDEX IX_comentarios_ticket_id ON comentarios(ticket_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_hist_tickets_ticket_id' AND object_id=OBJECT_ID('historial_tickets')) CREATE INDEX IX_hist_tickets_ticket_id ON historial_tickets(ticket_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_hist_inv_inventario_id' AND object_id=OBJECT_ID('historial_inventario')) CREATE INDEX IX_hist_inv_inventario_id ON historial_inventario(inventario_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_prestamos_inv_estado'  AND object_id=OBJECT_ID('prestamos'))          CREATE INDEX IX_prestamos_inv_estado  ON prestamos(inventario_id, estado);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_prestamos_grupo_id'    AND object_id=OBJECT_ID('prestamos'))          CREATE INDEX IX_prestamos_grupo_id    ON prestamos(grupo_id) WHERE grupo_id IS NOT NULL;
GO

-- 16.2  FK faltante: registro_aprobado_por → usuarios(id)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_usuarios_aprobado_por')
  ALTER TABLE usuarios WITH NOCHECK ADD CONSTRAINT FK_usuarios_aprobado_por FOREIGN KEY (registro_aprobado_por) REFERENCES usuarios(id);
GO

-- 16.3  UNIQUE: departamentos.nombre y número de serie por equipo de unidad
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_departamentos_nombre' AND object_id=OBJECT_ID('departamentos'))
  CREATE UNIQUE INDEX UQ_departamentos_nombre ON departamentos(nombre);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_inventario_serie_unidad' AND object_id=OBJECT_ID('inventario'))
  CREATE UNIQUE INDEX IX_inventario_serie_unidad ON inventario(numero_serie) WHERE tipo_manejo='unidad' AND numero_serie IS NOT NULL;
GO

-- 16.4  CHECK de dominio cerrado (valores = enums de la app)
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_tickets_status')
  ALTER TABLE tickets WITH NOCHECK ADD CONSTRAINT CK_tickets_status CHECK (status IN ('abierto','en_progreso','cerrado'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_tickets_prioridad')
  ALTER TABLE tickets WITH NOCHECK ADD CONSTRAINT CK_tickets_prioridad CHECK (prioridad IN ('Baja','Media','Alta','Crítica'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_tickets_categoria')
  ALTER TABLE tickets WITH NOCHECK ADD CONSTRAINT CK_tickets_categoria CHECK (categoria IN ('Hardware','Software','Red','Acceso','Otro'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_inventario_condicion')
  ALTER TABLE inventario WITH NOCHECK ADD CONSTRAINT CK_inventario_condicion CHECK (condicion IN ('nuevo','excelente','bueno','regular','danado'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_inventario_estado')
  ALTER TABLE inventario WITH NOCHECK ADD CONSTRAINT CK_inventario_estado CHECK (estado IN ('disponible','en_uso','en_prestamo','en_reparacion','de_baja'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_inventario_tipo_manejo')
  ALTER TABLE inventario WITH NOCHECK ADD CONSTRAINT CK_inventario_tipo_manejo CHECK (tipo_manejo IN ('unidad','cantidad'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_dispositivos_estado_fisico')
  ALTER TABLE dispositivos WITH NOCHECK ADD CONSTRAINT CK_dispositivos_estado_fisico CHECK (estado_fisico IN ('nuevo','excelente','bueno','regular','danado'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_prestamos_estado')
  ALTER TABLE prestamos WITH NOCHECK ADD CONSTRAINT CK_prestamos_estado CHECK (estado IN ('activo','devuelto'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_prestamos_cantidad')
  ALTER TABLE prestamos WITH NOCHECK ADD CONSTRAINT CK_prestamos_cantidad CHECK (cantidad >= 1 AND cantidad_devuelta >= 0 AND cantidad_devuelta <= cantidad);
GO

-- ============================================================
-- Fin del script
-- Siguiente paso: ejecutar procedimientos.sql y luego node server.js
-- ============================================================