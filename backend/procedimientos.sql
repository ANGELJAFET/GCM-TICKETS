-- ============================================================
--  GCM Tickets — Procedimientos Almacenados
--  Motor : SQL Server 2014 o superior
--  Uso   : Ejecutar en SSMS DESPUÉS de schema.sql
--          Puede ejecutarse varias veces (DROP IF EXISTS + CREATE)
-- ============================================================

USE [gcm_tickets];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- sp_GetUserForLogin  — devuelve usuario + rol para autenticación
-- ============================================================
IF OBJECT_ID('sp_GetUserForLogin','P') IS NOT NULL DROP PROCEDURE sp_GetUserForLogin;
GO
CREATE PROCEDURE sp_GetUserForLogin
  @username NVARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.id, u.username, u.password_hash, u.nombre, u.apellido,
         r.nombre AS rol,
         r.nivel  AS rol_nivel,
         u.acceso_inventario, u.acceso_prestamos, u.acceso_bitacora, u.acceso_solicitudes, u.acceso_usuarios
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  WHERE u.username = @username
    AND u.activo = 1
    AND u.registro_aprobado = 1;
END;
GO

-- ============================================================
-- sp_UpdateLastLogin  — actualiza timestamp de último acceso
-- ============================================================
IF OBJECT_ID('sp_UpdateLastLogin','P') IS NOT NULL DROP PROCEDURE sp_UpdateLastLogin;
GO
CREATE PROCEDURE sp_UpdateLastLogin
  @username NVARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE usuarios SET ultimo_login = GETDATE() WHERE username = @username;
END;
GO

-- ============================================================
-- sp_InsertSolicitudRegistro  — nueva solicitud de acceso
--   Lanza 50409 si el username ya existe o hay solicitud pendiente
-- ============================================================
IF OBJECT_ID('sp_InsertSolicitudRegistro','P') IS NOT NULL DROP PROCEDURE sp_InsertSolicitudRegistro;
GO
CREATE PROCEDURE sp_InsertSolicitudRegistro
  @nombre              NVARCHAR(100),
  @apellido            NVARCHAR(100) = NULL,
  @email               NVARCHAR(255) = NULL,
  @username            NVARCHAR(100),
  @password_hash       NVARCHAR(255),
  @telefono            NVARCHAR(20)  = NULL,
  @departamento_nombre NVARCHAR(255) = NULL,
  @finca               NVARCHAR(50)  = NULL,
  @area                NVARCHAR(255) = NULL,
  @mensaje             NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM usuarios WHERE username = @username)
    THROW 50409, 'El nombre de usuario ya existe.', 1;
  IF EXISTS (SELECT 1 FROM solicitudes_registro WHERE username = @username AND estado = 'pendiente')
    THROW 50409, 'Ya tienes una solicitud pendiente con ese usuario.', 1;

  INSERT INTO solicitudes_registro
    (nombre, apellido, email, username, password_hash, telefono, departamento_nombre, finca, area, mensaje)
  VALUES
    (@nombre, @apellido, @email, @username, @password_hash, @telefono, @departamento_nombre, @finca, @area, @mensaje);
END;
GO

-- ============================================================
-- sp_GetSolicitudes  — lista todas las solicitudes de acceso
-- ============================================================
IF OBJECT_ID('sp_GetSolicitudes','P') IS NOT NULL DROP PROCEDURE sp_GetSolicitudes;
GO
CREATE PROCEDURE sp_GetSolicitudes
AS
BEGIN
  SET NOCOUNT ON;
  SELECT sr.id, sr.nombre, sr.apellido, sr.email, sr.username,
         sr.telefono, sr.mensaje, sr.estado, sr.motivo_rechazo,
         sr.created_at, sr.revisado_en,
         sr.departamento_nombre AS departamento,
         sr.finca, sr.area,
         LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) AS revisado_por_nombre
  FROM solicitudes_registro sr
  LEFT JOIN usuarios u ON u.id = sr.revisado_por
  WHERE sr.estado <> 'eliminado'
  ORDER BY sr.created_at DESC;
END;
GO

-- ============================================================
-- sp_AprobarSolicitud
--   - Crea el departamento si no existe (Opción A)
--   - Inserta el usuario
--   - Marca la solicitud como aprobada
--   - Registra en auditoría
--   Todo en una sola transacción
--   Lanza 50404 si no se encuentra, 50409 en conflictos
-- ============================================================
IF OBJECT_ID('sp_AprobarSolicitud','P') IS NOT NULL DROP PROCEDURE sp_AprobarSolicitud;
GO
CREATE PROCEDURE sp_AprobarSolicitud
  @solicitud_id INT,
  @requestedBy  NVARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY
    DECLARE @estado              NVARCHAR(20),
            @username            NVARCHAR(100),
            @email               NVARCHAR(255),
            @password_hash       NVARCHAR(255),
            @nombre              NVARCHAR(100),
            @apellido            NVARCHAR(100),
            @telefono            NVARCHAR(20),
            @departamento_nombre NVARCHAR(255),
            @finca               NVARCHAR(50),
            @area                NVARCHAR(255);

    SELECT @estado              = estado,
           @username            = username,
           @email               = email,
           @password_hash       = password_hash,
           @nombre              = nombre,
           @apellido            = apellido,
           @telefono            = telefono,
           @departamento_nombre = departamento_nombre,
           @finca               = finca,
           @area                = area
    FROM solicitudes_registro WHERE id = @solicitud_id;

    IF @estado IS NULL
      THROW 50404, 'Solicitud no encontrada', 1;
    IF @estado <> 'pendiente'
      THROW 50409, 'La solicitud ya fue procesada', 1;
    IF EXISTS (SELECT 1 FROM usuarios WHERE username = @username AND activo = 1)
      THROW 50409, 'El nombre de usuario ya existe', 1;
    IF @email IS NOT NULL AND EXISTS (SELECT 1 FROM usuarios WHERE email = @email AND activo = 1)
      THROW 50409, 'Ya existe una cuenta con ese correo electrónico', 1;

    -- Resolver departamento: buscar por nombre, crear si no existe
    DECLARE @deptId INT = NULL;
    IF @departamento_nombre IS NOT NULL
    BEGIN
      SELECT @deptId = id FROM departamentos
      WHERE LOWER(nombre) = LOWER(LTRIM(RTRIM(@departamento_nombre)));

      IF @deptId IS NULL
      BEGIN
        INSERT INTO departamentos (nombre) VALUES (LTRIM(RTRIM(@departamento_nombre)));
        SET @deptId = SCOPE_IDENTITY();
      END;
    END;

    -- Insertar usuario como empleado
    DECLARE @rolId TINYINT = (SELECT id FROM roles WHERE nombre = 'empleado');
    INSERT INTO usuarios
      (username, email, password_hash, nombre, apellido, telefono,
       departamento_id, finca, area, rol_id, activo, registro_aprobado)
    VALUES
      (@username, @email, @password_hash, @nombre, @apellido, @telefono,
       @deptId, @finca, @area, @rolId, 1, 1);

    -- Marcar solicitud como aprobada
    DECLARE @adminId INT = (SELECT id FROM usuarios WHERE username = @requestedBy);
    UPDATE solicitudes_registro
    SET estado = 'aprobado', revisado_por = @adminId, revisado_en = GETDATE()
    WHERE id = @solicitud_id;

    -- Auditoría
    INSERT INTO auditoria (actor, accion, entidad, entidad_id, detalle)
    VALUES (@requestedBy, 'Aprobó solicitud de acceso', 'solicitud',
            CAST(@solicitud_id AS NVARCHAR(50)),
            '@' + @username +
            CASE WHEN @nombre IS NOT NULL
              THEN ' — ' + @nombre + ISNULL(' ' + @apellido, '')
              ELSE '' END);

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

-- ============================================================
-- sp_RechazarSolicitud
-- ============================================================
IF OBJECT_ID('sp_RechazarSolicitud','P') IS NOT NULL DROP PROCEDURE sp_RechazarSolicitud;
GO
CREATE PROCEDURE sp_RechazarSolicitud
  @solicitud_id INT,
  @requestedBy  NVARCHAR(100),
  @motivo       NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY
    DECLARE @estado   NVARCHAR(20),
            @username NVARCHAR(100),
            @nombre   NVARCHAR(100),
            @apellido NVARCHAR(100);

    SELECT @estado = estado, @username = username, @nombre = nombre, @apellido = apellido
    FROM solicitudes_registro WHERE id = @solicitud_id;

    IF @estado IS NULL
      THROW 50404, 'Solicitud no encontrada', 1;
    IF @estado <> 'pendiente'
      THROW 50409, 'La solicitud ya fue procesada', 1;

    DECLARE @adminId INT = (SELECT id FROM usuarios WHERE username = @requestedBy);
    UPDATE solicitudes_registro
    SET estado = 'rechazado', motivo_rechazo = @motivo,
        revisado_por = @adminId, revisado_en = GETDATE()
    WHERE id = @solicitud_id;

    INSERT INTO auditoria (actor, accion, entidad, entidad_id, detalle)
    VALUES (@requestedBy, 'Rechazó solicitud de acceso', 'solicitud',
            CAST(@solicitud_id AS NVARCHAR(50)),
            '@' + ISNULL(@username, CAST(@solicitud_id AS NVARCHAR)) +
            CASE WHEN @motivo IS NOT NULL THEN ' — ' + @motivo ELSE '' END);

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

-- ============================================================
-- sp_GetUsuarios  — lista todos los usuarios con rol y departamento
-- ============================================================
IF OBJECT_ID('sp_GetUsuarios','P') IS NOT NULL DROP PROCEDURE sp_GetUsuarios;
GO
CREATE PROCEDURE sp_GetUsuarios
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.telefono,
         d.nombre AS departamento,
         u.finca, u.area,
         r.nombre AS rol, r.nivel,
         u.activo, u.ultimo_login, u.created_at,
         u.acceso_inventario, u.acceso_prestamos, u.acceso_bitacora, u.acceso_solicitudes
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN departamentos d ON d.id = u.departamento_id
  ORDER BY r.nivel DESC, u.nombre;
END;
GO

-- ============================================================
-- sp_GetAdmins  — lista técnicos y administradores activos
-- ============================================================
IF OBJECT_ID('sp_GetAdmins','P') IS NOT NULL DROP PROCEDURE sp_GetAdmins;
GO
CREATE PROCEDURE sp_GetAdmins
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.id,
         u.username,
         LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) AS nombre,
         r.nombre AS rol,
         r.nivel,
         u.acceso_inventario, u.acceso_prestamos, u.acceso_bitacora, u.acceso_solicitudes, u.acceso_usuarios
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  WHERE r.nivel >= 2 AND u.activo = 1
  ORDER BY r.nivel DESC, u.nombre;
END;
GO

-- ============================================================
-- sp_GetTickets  — todos los tickets con nombre del asignado
-- ============================================================
IF OBJECT_ID('sp_GetTickets','P') IS NOT NULL DROP PROCEDURE sp_GetTickets;
GO
CREATE PROCEDURE sp_GetTickets
AS
BEGIN
  SET NOCOUNT ON;
  SELECT t.*,
         LTRIM(RTRIM(CONCAT(a.nombre, ' ', ISNULL(a.apellido, '')))) AS asignado_display,
         a.username AS asignado_username,
         CASE WHEN r.id IS NULL THEN t.reporter_nombre
              ELSE LTRIM(RTRIM(CONCAT(r.nombre, ' ', ISNULL(r.apellido, '')))) END AS reporter_display
  FROM tickets t
  LEFT JOIN usuarios a ON a.id = t.asignado_id
  LEFT JOIN usuarios r ON r.id = t.reporter_id
  ORDER BY t.created_at DESC;
END;
GO

-- ============================================================
-- sp_GetTicket  — un ticket por ID con nombre del asignado
-- ============================================================
IF OBJECT_ID('sp_GetTicket','P') IS NOT NULL DROP PROCEDURE sp_GetTicket;
GO
CREATE PROCEDURE sp_GetTicket
  @id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT t.*,
         LTRIM(RTRIM(CONCAT(a.nombre, ' ', ISNULL(a.apellido, '')))) AS asignado_display,
         a.username AS asignado_username,
         CASE WHEN r.id IS NULL THEN t.reporter_nombre
              ELSE LTRIM(RTRIM(CONCAT(r.nombre, ' ', ISNULL(r.apellido, '')))) END AS reporter_display
  FROM tickets t
  LEFT JOIN usuarios a ON a.id = t.asignado_id
  LEFT JOIN usuarios r ON r.id = t.reporter_id
  WHERE t.id = @id;
END;
GO

-- ============================================================
-- sp_GetComentarios  — comentarios públicos o notas internas de un ticket
-- ============================================================
IF OBJECT_ID('sp_GetComentarios','P') IS NOT NULL DROP PROCEDURE sp_GetComentarios;
GO
CREATE PROCEDURE sp_GetComentarios
  @ticket_id  NVARCHAR(20),
  @es_interno BIT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CASE WHEN u.id IS NULL THEN c.autor_nombre
              ELSE LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) END AS autor_display,
         r.nivel AS autor_rol_nivel,
         c.texto, c.created_at
  FROM comentarios c
  LEFT JOIN usuarios u ON u.id = c.autor_id
  LEFT JOIN roles r ON r.id = u.rol_id
  WHERE c.ticket_id = @ticket_id AND c.es_interno = @es_interno
  ORDER BY c.created_at;
END;
GO

-- ============================================================
-- sp_GetHistorialTicket  — historial de cambios de un ticket
-- ============================================================
IF OBJECT_ID('sp_GetHistorialTicket','P') IS NOT NULL DROP PROCEDURE sp_GetHistorialTicket;
GO
CREATE PROCEDURE sp_GetHistorialTicket
  @ticket_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CASE WHEN u.id IS NULL THEN h.usuario_nombre
              ELSE LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) END AS usuario_display,
         h.accion, h.created_at
  FROM historial_tickets h
  LEFT JOIN usuarios u ON u.id = h.usuario_id
  WHERE h.ticket_id = @ticket_id
  ORDER BY h.created_at;
END;
GO

-- ============================================================
-- sp_GetAdjuntos  — archivos adjuntos de un ticket
-- ============================================================
IF OBJECT_ID('sp_GetAdjuntos','P') IS NOT NULL DROP PROCEDURE sp_GetAdjuntos;
GO
CREATE PROCEDURE sp_GetAdjuntos
  @ticket_id NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT nombre_original, nombre_archivo, tamano_bytes, created_at
  FROM adjuntos
  WHERE ticket_id = @ticket_id
  ORDER BY created_at;
END;
GO

-- ============================================================
-- sp_GetDevices  — dispositivos en taller con nombre del técnico
-- ============================================================
IF OBJECT_ID('sp_GetDevices','P') IS NOT NULL DROP PROCEDURE sp_GetDevices;
GO
CREATE PROCEDURE sp_GetDevices
AS
BEGIN
  SET NOCOUNT ON;
  SELECT d.*,
         LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) AS tecnico_display
  FROM dispositivos d
  LEFT JOIN usuarios u ON u.id = d.tecnico_id
  ORDER BY d.created_at DESC;
END;
GO

-- ============================================================
-- sp_CrearDispositivoConTicket
--   Crea el dispositivo de taller y su ticket de reparación en
--   una sola transacción (antes eran 2 INSERT sueltos desde Node,
--   sin atomicidad ante fallos a mitad de camino).
-- ============================================================
IF OBJECT_ID('sp_CrearDispositivoConTicket','P') IS NOT NULL DROP PROCEDURE sp_CrearDispositivoConTicket;
GO
CREATE PROCEDURE sp_CrearDispositivoConTicket
  @dev_id          NVARCHAR(20),
  @ticket_id       NVARCHAR(20),
  @tipo            NVARCHAR(100),
  @marca           NVARCHAR(100),
  @modelo          NVARCHAR(100) = NULL,
  @numero_serie    NVARCHAR(200) = NULL,
  @estado_fisico   NVARCHAR(20)  = 'bueno',
  @falla_cliente   NVARCHAR(MAX),
  @accesorios      NVARCHAR(MAX) = NULL,
  @cliente_nombre  NVARCHAR(200),
  @cliente_tel     NVARCHAR(50)  = NULL,
  @tecnico_id      INT           = NULL,
  @tecnico_display NVARCHAR(200) = NULL,
  @titulo          NVARCHAR(500),
  @descripcion     NVARCHAR(MAX),
  @reporter_nombre NVARCHAR(300) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY
    INSERT INTO dispositivos
      (id, tipo, marca, modelo, numero_serie, estado_fisico,
       falla_cliente, accesorios, cliente_nombre, cliente_tel, tecnico_id)
    VALUES
      (@dev_id, @tipo, @marca, @modelo, @numero_serie, @estado_fisico,
       @falla_cliente, @accesorios, @cliente_nombre, @cliente_tel, @tecnico_id);

    INSERT INTO tickets
      (id, titulo, descripcion, status, prioridad, categoria,
       reporter_nombre, asignado_id, device_id)
    VALUES
      (@ticket_id, @titulo, @descripcion, 'abierto', 'Media', 'Hardware',
       @reporter_nombre, @tecnico_id, @dev_id);

    INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion)
    VALUES (@ticket_id, ISNULL(@tecnico_display, 'Sin asignar'),
            CONCAT('Equipo recibido de ', @cliente_nombre, '. ID dispositivo: ', @dev_id));

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

-- ============================================================
-- sp_GetInventory  — inventario con nombre del responsable
-- ============================================================
IF OBJECT_ID('sp_GetInventory','P') IS NOT NULL DROP PROCEDURE sp_GetInventory;
GO
CREATE PROCEDURE sp_GetInventory
AS
BEGIN
  SET NOCOUNT ON;
  SELECT i.*,
         LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) AS responsable_display
  FROM inventario i
  LEFT JOIN usuarios u ON u.id = i.responsable_id
  ORDER BY i.created_at DESC;
END;
GO

-- ============================================================
-- sp_GetLoans  — préstamos con descripción del equipo y empleado
-- ============================================================
IF OBJECT_ID('sp_GetLoans','P') IS NOT NULL DROP PROCEDURE sp_GetLoans;
GO
CREATE PROCEDURE sp_GetLoans
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.*,
         CONCAT(i.marca, ' ', ISNULL(i.modelo, i.tipo)) AS equipoDesc,
         LTRIM(RTRIM(CONCAT(e.nombre, ' ', ISNULL(e.apellido, '')))) AS empleado_display,
         LTRIM(RTRIM(CONCAT(a.nombre, ' ', ISNULL(a.apellido, '')))) AS autorizado_display
  FROM prestamos p
  JOIN inventario i ON i.id = p.inventario_id
  LEFT JOIN usuarios e ON e.id = p.empleado_id
  LEFT JOIN usuarios a ON a.id = p.autorizado_por_id
  ORDER BY p.created_at DESC;
END;
GO

-- ============================================================
-- sp_GetDepartamentos  — departamentos activos para selects
-- ============================================================
IF OBJECT_ID('sp_GetDepartamentos','P') IS NOT NULL DROP PROCEDURE sp_GetDepartamentos;
GO
CREATE PROCEDURE sp_GetDepartamentos
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, nombre FROM departamentos WHERE activo = 1 ORDER BY nombre;
END;
GO

-- ============================================================
-- sp_LogAudit  — registra una acción en la bitácora
-- ============================================================
IF OBJECT_ID('sp_LogAudit','P') IS NOT NULL DROP PROCEDURE sp_LogAudit;
GO
CREATE PROCEDURE sp_LogAudit
  @actor      NVARCHAR(150) = NULL,
  @accion     NVARCHAR(300),
  @entidad    NVARCHAR(50)  = NULL,
  @entidad_id NVARCHAR(50)  = NULL,
  @detalle    NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO auditoria (actor, accion, entidad, entidad_id, detalle)
  VALUES (@actor, @accion, @entidad, @entidad_id, @detalle);
END;
GO

-- ============================================================
-- sp_GetAuditoria  — bitácora con filtros opcionales
-- ============================================================
IF OBJECT_ID('sp_GetAuditoria','P') IS NOT NULL DROP PROCEDURE sp_GetAuditoria;
GO
CREATE PROCEDURE sp_GetAuditoria
  @actor   NVARCHAR(150) = NULL,
  @entidad NVARCHAR(50)  = NULL,
  @desde   DATE          = NULL,
  @hasta   DATE          = NULL,
  @limit   INT           = 200
AS
BEGIN
  SET NOCOUNT ON;
  IF @limit > 500 SET @limit = 500;
  IF @limit < 1   SET @limit = 1;

  SELECT TOP (@limit) id, fecha, actor, accion, entidad, entidad_id, detalle
  FROM auditoria
  WHERE (@actor   IS NULL OR actor   = @actor)
    AND (@entidad IS NULL OR entidad = @entidad)
    AND (@desde   IS NULL OR fecha  >= @desde)
    AND (@hasta   IS NULL OR fecha   < DATEADD(day, 1, @hasta))
  ORDER BY fecha DESC;
END;
GO

-- ============================================================
-- Fin del script — procedimientos creados: 20
-- ============================================================


select * from usuarios;