# GCM Tickets — Sistema de Soporte Técnico
Sistema de helpdesk interno para Grupo Milcien S.A. de C.V.

## Qué hace el sistema

Es una plataforma interna con dos portales (empleados y administración/TI) para gestionar tickets de soporte técnico, inventario de equipos, préstamos y solicitudes de acceso, todo con autenticación real y roles.

### Roles

| Rol | Nivel | Puede |
|---|---|---|
| **Empleado** | 1 | Portal de usuario: crear y dar seguimiento a sus propios tickets |
| **Técnico** | 2 | Panel admin: gestionar tickets. Ver el listado general de usuarios solo si el superadmin le otorga el módulo "Usuarios" |
| **Admin** | 3 | Panel admin: gestión completa de tickets; activar/desactivar y eliminar usuarios; altas de técnicos. Ver el listado de usuarios solo si el superadmin le otorga el módulo "Usuarios" |
| **Superadmin** | 4 | Todo lo anterior + control total sin restricciones, incluyendo cambiar la contraseña de cualquier usuario |

El inicio de sesión es obligatorio en ambos portales (JWT, 12 horas de validez). No hay acciones anónimas ni campos de "nombre" libres — todo queda ligado a la cuenta que inició sesión.

### Permisos por módulo (otorgados por el superadmin)

Cinco secciones del panel admin están restringidas por defecto a **solo el superadmin**. Cualquier otro usuario (técnico o admin) necesita que el superadmin le otorgue el permiso específico, uno por uno, desde el modal de "Usuarios administradores":

- **Inventario** (equipos)
- **Préstamos**
- **Bitácora** (auditoría del sistema)
- **Solicitudes de registro** (aprobar/rechazar altas de empleados)
- **Usuarios** (ver el listado "Usuarios registrados" con los datos personales — correo, teléfono, finca, área — de todos los usuarios)

Cambiar la contraseña de otro usuario está reservado exclusivamente al superadmin, sin importar los permisos de módulo otorgados. Activar/desactivar y eliminar usuarios sigue disponible para admin/técnico según el rol normal, pero requiere primero tener acceso al módulo "Usuarios" para poder ver el listado.

### Portal de empleados

- Registro de cuenta con nombre, usuario, correo (obligatorio), teléfono, departamento, **finca** (selección de la finca donde trabaja, o "No aplica" si no es de finca) y **área**. La cuenta queda pendiente hasta que un administrador la aprueba.
- Crear tickets con prioridad, categoría y adjuntos (imágenes, video, documentos).
- Subir adjuntos desde el celular escaneando un código QR generado por el ticket, sin necesidad de iniciar sesión en el teléfono.
- Ver el estado y el historial de sus propios tickets.

### Panel de administración

- **Tickets**: bandeja con filtros, asignación a técnicos, cambio de estado, comentarios (visibles para el empleado) y notas internas (solo staff), estadísticas y gráficos.
- **Usuarios**: lista de empleados y del personal del sistema, aprobar/rechazar solicitudes de registro, activar/desactivar cuentas, resetear contraseñas.
- **Inventario**: dos modos de manejo por equipo, elegidos al momento de registrarlo y fijos después:
  - *Por unidad* — un equipo físico con número de serie obligatorio (laptops, routers, impresoras…). Solo puede estar prestado a una persona a la vez.
  - *Por cantidad* — un lote sin serie individual (cables, mouse, teclados…) con una cantidad total; admite varios préstamos simultáneos mientras haya stock disponible.
- **Préstamos**: registro de equipo/lote prestado a un empleado, con fecha estimada de devolución, autorización y generación de un comprobante imprimible. Los préstamos por cantidad admiten devolución parcial (por ejemplo, devolver 1 de 2 unidades prestadas).
- **Bitácora**: registro de auditoría de todas las acciones administrativas (quién, qué y cuándo), con filtros por usuario, área y fecha.
- **Notificaciones por correo** (opcional): aviso al administrador cuando llega una solicitud de registro o un ticket nuevo, y al empleado cuando cambia el estado de su ticket.

## Requisitos

- [Node.js](https://nodejs.org) v18 o superior
- SQL Server 2014 o superior (Express es suficiente)
- Windows (el arranque usa `start.bat`)

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/ANGELJAFET/SistemaApp.git
cd SistemaApp
```

### 2. Configurar variables de entorno
```bash
copy .env.example .env
```
Edita `.env` con los datos de tu servidor:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_SERVER` | IP o nombre del servidor SQL Server | `192.168.1.50` |
| `DB_PORT` | Puerto SQL Server (default 1433) | `1433` |
| `DB_USER` | Usuario de SQL Server | `sa` |
| `DB_PASSWORD` | Contraseña de SQL Server | `MiPassword@2024` |
| `DB_NAME` | Nombre de la base de datos | `gcm_tickets` |
| `PORT` | Puerto del servidor Node.js | `3000` |
| `SESSION_SECRET` | Cadena secreta para firmar los tokens de sesión (cámbiala) | `cadena_aleatoria_larga` |
| `ADMIN_PASSWORD` | Contraseña inicial del usuario `admin` | `admin123` |

### 3. Ejecutar
```
start.bat
```

La primera vez que se ejecuta `start.bat`:
- Instala las dependencias de Node.js automáticamente
- Crea la base de datos, tablas, roles y stored procedures en SQL Server
- Crea el usuario `admin` (superadmin) si no existe
- Arranca el servidor

**De ahí en adelante** solo doble clic en `start.bat` — no necesitas SSMS ni ejecutar SQL manualmente.

## Uso diario

```
start.bat
```

Abre el navegador en `http://localhost:3000`

## Acceso inicial

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Superadmin |

> Para cambiar la contraseña inicial antes de instalar, edita `ADMIN_PASSWORD` en tu archivo `.env`.
> Solo aplica si el usuario `admin` no existe aún — si ya existe, el setup no lo modifica.

## Estructura del proyecto

```
SistemaAPP/
├── server.js               — Servidor Express principal
├── setup.js                — Configura la BD (ejecutado automáticamente por start.bat)
├── start.bat               — Arranque completo en Windows
├── schema.sql              — Tablas, roles, seeds y migraciones
├── procedimientos.sql      — Stored Procedures
├── .env.example            — Plantilla de configuración
├── src/
│   ├── db.js               — Pool de conexión y helpers de BD
│   ├── config.js
│   ├── helpers.js           — Auditoría, formato de fechas
│   ├── ticketLoader.js
│   ├── mobileSessions.js
│   ├── mailer.js            — Notificaciones por correo
│   ├── middleware/
│   │   ├── auth.js          — Verifica sesión (JWT) y permisos por rol/módulo
│   │   └── upload.js        — Subida de adjuntos
│   └── routes/
│       ├── auth.js          — Login y registro
│       ├── tickets.js       — CRUD de tickets
│       ├── usuarios.js      — Usuarios, solicitudes de acceso y permisos
│       ├── inventory.js     — Inventario, préstamos y bitácora
│       └── mobileUpload.js  — Adjuntos desde celular vía QR
└── public/
    ├── admin.html/js        — Panel TI / administración
    ├── usuario.html/js      — Portal empleados
    ├── registro.html        — Solicitud de acceso
    └── mobile-upload.html   — Subida de adjuntos desde el celular
```

## Actualizar esquema o stored procedures

Si recibes una actualización que incluye cambios en `schema.sql` o `procedimientos.sql`:

```bash
git pull
npm run setup
```

Luego arranca normalmente con `start.bat`.

## Configuración de email (opcional)

Para activar notificaciones por correo, completa las variables `SMTP_*` en `.env`
usando una [Contraseña de aplicación de Google](https://myaccount.google.com/apppasswords).
