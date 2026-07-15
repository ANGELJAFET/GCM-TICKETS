# GCM Tickets — Sistema de Soporte Técnico
Sistema de helpdesk interno para Grupo Milcien S.A. de C.V.

Proyecto dividido en dos partes independientes:

- **`backend/`** — API en Express + TypeScript + JWT, conectada a SQL Server.
- **`web/`** — Frontend en Next.js + TypeScript + Tailwind (panel admin y portal de empleados).

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
- Windows (el arranque usa `start.bat` / `start-web.bat`)

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/ANGELJAFET/SistemaApp.git
cd SistemaApp
```

### 2. Configurar variables de entorno del backend
```bash
cd backend
copy .env.example .env
```
Edita `backend\.env` con los datos de tu servidor:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_SERVER` | IP o nombre del servidor SQL Server | `192.168.1.50` |
| `DB_PORT` | Puerto SQL Server (default 1433) | `1433` |
| `DB_USER` | Usuario de SQL Server | `sa` |
| `DB_PASSWORD` | Contraseña de SQL Server | `MiPassword@2024` |
| `DB_NAME` | Nombre de la base de datos | `gcm_tickets` |
| `PORT` | Puerto del backend (API) | `3000` |
| `SESSION_SECRET` | Cadena secreta para firmar los tokens de sesión (cámbiala) | `cadena_aleatoria_larga` |
| `ADMIN_PASSWORD` | Contraseña inicial del usuario `admin` | `admin123` |
| `WEB_PORT` | Puerto donde corre `web/` (Next.js) | `3001` |
| `WEB_APP_URL` | URL pública del frontend (opcional) — usada por el QR de "subir desde celular" y los links de los correos de notificación. Si se deja vacío, se detecta la IP de red automáticamente | *(vacío)* |

### 3. Ejecutar

```
start.bat
```
Arranca el **backend** (API), en `http://localhost:3000`. La primera vez:
- Instala las dependencias de Node.js automáticamente
- Crea la base de datos, tablas, roles y stored procedures en SQL Server
- Crea el usuario `admin` (superadmin) si no existe
- Compila el backend TypeScript y lo arranca

```
start-web.bat
```
Arranca el **frontend** (Next.js), en `http://localhost:3001`. Requiere que `start.bat` esté corriendo a la vez (usa la misma API).

**De ahí en adelante** solo doble clic en ambos — no necesitas SSMS ni ejecutar SQL manualmente.

## Uso diario

Ejecuta `start.bat` y `start-web.bat` (cada uno en su propia ventana), luego abre el navegador en:

- `http://localhost:3001/admin` — panel TI / administración
- `http://localhost:3001/portal` — portal de empleados

## Acceso inicial

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Superadmin |

> Para cambiar la contraseña inicial antes de instalar, edita `ADMIN_PASSWORD` en `backend\.env`.
> Solo aplica si el usuario `admin` no existe aún — si ya existe, el setup no lo modifica.

## Estructura del proyecto

```
SistemaAPP/
├── start.bat                  — Arranque del backend en Windows
├── start-web.bat              — Arranque del frontend en Windows
├── ecosystem.config.js        — Config de PM2 (backend + frontend) para producción
├── setup-servidor.ps1         — Instalación como servicio permanente (Windows Server)
├── backup.ps1                 — Backup diario de BD + uploads
│
├── backend/                   — API (Express + TypeScript + JWT)
│   ├── server.ts              — Punto de entrada
│   ├── tsconfig.json          — Config de compilación (→ dist/)
│   ├── package.json
│   ├── .env / .env.example    — Configuración (BD, JWT, SMTP, puertos)
│   ├── setup.js               — Configura la BD (ejecutado automáticamente por start.bat)
│   ├── schema.sql             — Tablas, roles, seeds y migraciones
│   ├── procedimientos.sql     — Stored Procedures
│   ├── assets/gcm.jpg         — Logo usado en los correos de notificación
│   ├── uploads/                — Adjuntos subidos por los usuarios (no versionado)
│   └── src/
│       ├── db.ts              — Pool de conexión y helpers de BD
│       ├── config.ts
│       ├── helpers.ts          — Auditoría, formato de fechas, URL del frontend
│       ├── ticketLoader.ts
│       ├── mobileSessions.ts
│       ├── mailer.ts           — Notificaciones por correo
│       ├── types.ts            — Tipos compartidos del backend
│       ├── middleware/
│       │   ├── auth.ts         — Verifica sesión (JWT) y permisos por rol/módulo
│       │   └── upload.ts       — Subida de adjuntos
│       └── routes/
│           ├── auth.ts         — Login y registro
│           ├── tickets.ts      — CRUD de tickets
│           ├── usuarios.ts     — Usuarios, solicitudes de acceso y permisos
│           ├── inventory.ts    — Inventario, préstamos y bitácora
│           └── mobileUpload.ts — Adjuntos desde celular vía QR
│
└── web/                        — Frontend (Next.js + TypeScript + Tailwind)
    ├── app/
    │   ├── portal/             — Portal de empleados
    │   ├── admin/              — Panel TI / administración
    │   │   ├── inventario/     — Equipos, préstamos, responsables
    │   │   ├── usuarios/       — Gestión de usuarios y solicitudes de acceso
    │   │   └── auditoria/      — Bitácora del sistema
    │   ├── registro/           — Solicitud de acceso
    │   └── mobile-upload/      — Subida de adjuntos desde el celular (QR)
    ├── components/ui/          — Componentes compartidos (Modal, Toast, Tabs…)
    └── lib/                    — Cliente API, auth, tipos compartidos del frontend
```

## Actualizar esquema o stored procedures

Si recibes una actualización que incluye cambios en `backend/schema.sql` o `backend/procedimientos.sql`:

```bash
git pull
cd backend
npm run setup
```

Luego arranca normalmente con `start.bat`.

## Configuración de email (opcional)

Para activar notificaciones por correo, completa las variables `SMTP_*` en `backend\.env`
usando una [Contraseña de aplicación de Google](https://myaccount.google.com/apppasswords).
