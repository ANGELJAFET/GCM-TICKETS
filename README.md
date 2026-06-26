# GCM Tickets — Sistema de Soporte Técnico
Sistema de helpdesk interno para Grupo Milcien S.A. de C.V.

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
| `SESSION_SECRET` | Cadena secreta para sesiones (cámbiala) | `cadena_aleatoria_larga` |

### 3. Ejecutar
```
start.bat
```

La primera vez que se ejecuta `start.bat`:
- Instala las dependencias de Node.js automáticamente
- Crea la base de datos, tablas y stored procedures en SQL Server
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
├── schema.sql              — Tablas, seeds y migraciones
├── procedimientos.sql      — 19 Stored Procedures
├── .env.example            — Plantilla de configuración
├── src/
│   ├── db.js               — Pool de conexión y helpers de BD
│   ├── config.js
│   ├── helpers.js
│   ├── ticketLoader.js
│   ├── mobileSessions.js
│   └── routes/
│       ├── auth.js         — Login y registro
│       ├── tickets.js      — CRUD de tickets
│       ├── usuarios.js     — Usuarios y solicitudes de acceso
│       ├── inventory.js    — Inventario y préstamos
│       └── mobileUpload.js
└── public/
    ├── admin.html          — Panel TI / administración
    ├── usuario.html        — Portal empleados
    └── registro.html       — Solicitud de acceso
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
