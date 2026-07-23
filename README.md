# GCM Tickets — Sistema de Soporte Técnico
Sistema de helpdesk interno para Grupo Milcien S.A. de C.V.

Proyecto dividido en dos partes independientes:

- **`api/`** — API en Express + TypeScript + JWT, conectada a SQL Server.
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

## Tecnologías utilizadas

**Backend (`api/`)**

| Tecnología | Uso |
|---|---|
| [Express](https://expressjs.com/) | Framework HTTP |
| TypeScript | Tipado estático, compilado a `dist/` |
| [mssql](https://www.npmjs.com/package/mssql) | Driver de conexión a SQL Server |
| [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) | Emisión/verificación de JWT de sesión |
| [bcrypt](https://www.npmjs.com/package/bcrypt) | Hash de contraseñas |
| [multer](https://www.npmjs.com/package/multer) | Subida de archivos adjuntos (multipart/form-data) |
| [helmet](https://www.npmjs.com/package/helmet) | Cabeceras de seguridad HTTP |
| [cors](https://www.npmjs.com/package/cors) | Habilita peticiones desde otros orígenes (LAN) |
| [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) | Límite de intentos en login/registro |
| [nodemailer](https://www.npmjs.com/package/nodemailer) | Envío de correos de notificación |
| [qrcode](https://www.npmjs.com/package/qrcode) | Generación del QR de "subir desde celular" |
| [dotenv](https://www.npmjs.com/package/dotenv) | Carga de variables de entorno desde `.env` |
| [tsx](https://www.npmjs.com/package/tsx) | Ejecución de TypeScript en desarrollo (`npm run dev`) |

**Frontend (`web/`)**

| Tecnología | Uso |
|---|---|
| [Next.js](https://nextjs.org/) (App Router) | Framework de React, SSR y enrutamiento por carpetas |
| React | UI |
| TypeScript | Tipado estático |
| [Tailwind CSS](https://tailwindcss.com/) | Estilos utilitarios |
| [SWR](https://swr.vercel.app/) | Fetching de datos con cache y revalidación automática |
| [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://www.npmjs.com/package/react-chartjs-2) | Gráficos del panel admin (tickets e inventario) |
| [@tabler/icons-react](https://tabler.io/icons) | Iconografía |
| [clsx](https://www.npmjs.com/package/clsx) | Composición condicional de clases CSS |
| [xlsx](https://www.npmjs.com/package/xlsx) | Exportación del listado de tickets a Excel |
| ESLint | Linting |

## Arquitectura del proyecto

Arquitectura cliente-servidor clásica, con backend y frontend como aplicaciones Node.js independientes que se despliegan y escalan por separado:

- **`api/`** expone una API REST bajo `/api/*` (JSON) más un servidor de archivos estáticos en `/uploads`. No sirve HTML — es consumida únicamente por `web/` (y, en el caso de `/api/mobile-upload`, directamente por el navegador del celular). Toda el acceso a datos pasa por `src/db.ts`, que habla con SQL Server vía stored procedures (`procedimientos.sql`) o queries inline traducidas de sintaxis MySQL a T-SQL.
- **`web/`** es una SPA renderizada con Next.js (App Router) que consume esa API vía `fetch` (`lib/api.ts`). No tiene backend propio ni acceso directo a la base de datos.
- La autenticación es **stateless**: un JWT firmado con `SESSION_SECRET` (HS256, 12h de validez) viaja en el header `Authorization: Bearer` en cada petición; el frontend lo guarda en `sessionStorage` (no en cookies), separado por namespace para el panel admin y el portal de empleados (ver `lib/auth.tsx`).
- El flujo de "subir adjunto desde el celular" (tickets y fotos de inventario) usa una sesión efímera en memoria (`api/src/mobileSessions.ts`) identificada por un token aleatorio y expuesta como QR — el celular sube el archivo sin necesitar sesión ni JWT.
- No hay mensajería ni colas: las notificaciones por correo se envían de forma síncrona (best-effort) en el mismo request que genera el evento (nuevo ticket, cambio de estado, nueva solicitud).

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
cd api
copy .env.example .env
```
Edita `api\.env` con los datos de tu servidor:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_SERVER` | IP o nombre del servidor SQL Server | `192.168.1.50` |
| `DB_PORT` | Puerto SQL Server (default 1433) | `1433` |
| `DB_USER` | Usuario de SQL Server | `sa` |
| `DB_PASSWORD` | Contraseña de SQL Server | `MiPassword@2024` |
| `DB_NAME` | Nombre de la base de datos | `gcm_tickets` |
| `PORT` | Puerto del backend (API) | `8080` |
| `SESSION_SECRET` | Cadena secreta para firmar los tokens de sesión (cámbiala) | `cadena_aleatoria_larga` |
| `ADMIN_PASSWORD` | Contraseña inicial del usuario `admin` | `admin123` |
| `WEB_PORT` | Puerto donde corre `web/` (Next.js) | `8081` |
| `WEB_APP_URL` | URL pública del frontend (opcional) — usada por el QR de "subir desde celular" y los links de los correos de notificación. Si se deja vacío, se detecta la IP de red automáticamente | *(vacío)* |

### 3. Ejecutar

```
start.bat
```
Arranca el **backend** (API), en `http://localhost:8080`. La primera vez:
- Instala las dependencias de Node.js automáticamente
- Crea la base de datos, tablas, roles y stored procedures en SQL Server
- Crea el usuario `admin` (superadmin) si no existe
- Compila el backend TypeScript y lo arranca

```
start-web.bat
```
Arranca el **frontend** (Next.js), en `http://localhost:8081`. Requiere que `start.bat` esté corriendo a la vez (usa la misma API).

**De ahí en adelante** solo doble clic en ambos — no necesitas SSMS ni ejecutar SQL manualmente.

## Uso diario

Ejecuta `start.bat` y `start-web.bat` (cada uno en su propia ventana), luego abre el navegador en:

- `http://localhost:8081/admin` — panel TI / administración
- `http://localhost:8081/portal` — portal de empleados

## Acceso inicial

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Superadmin |

> Para cambiar la contraseña inicial antes de instalar, edita `ADMIN_PASSWORD` en `api\.env`.
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
├── api/                       — API (Express + TypeScript + JWT)
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

Si recibes una actualización que incluye cambios en `api/schema.sql` o `api/procedimientos.sql`:

```bash
git pull
cd api
npm run setup
```

Luego arranca normalmente con `start.bat`.

## Configuración de email (opcional)

Para activar notificaciones por correo, completa las variables `SMTP_*` en `api\.env`
usando una [Contraseña de aplicación de Google](https://myaccount.google.com/apppasswords).

## Variables de entorno — referencia completa

### `api/.env` (ver también la tabla de la sección Instalación)

| Variable | Requerida | Descripción |
|---|---|---|
| `DB_SERVER` | Sí | Host de SQL Server |
| `DB_PORT` | No (default `1433`) | Puerto de SQL Server |
| `DB_USER` | No (default `sa`) | Usuario de SQL Server |
| `DB_PASSWORD` | **Sí** | Contraseña de SQL Server — el proceso no arranca sin ella |
| `DB_NAME` | No (default `gcm_tickets`) | Nombre de la base de datos |
| `PORT` | No (default `8080`) | Puerto donde escucha la API |
| `NODE_ENV` | No | `production` en despliegue; afecta solo mensajes/optimización de dependencias, no lógica propia |
| `SESSION_SECRET` | **Sí** (mín. 32 caracteres) | Secreto de firma de los JWT — el proceso no arranca sin uno suficientemente largo |
| `BCRYPT_ROUNDS` | No (default `12`) | Costo de hashing de contraseñas |
| `ADMIN_PASSWORD` | No (default `admin123`) | Contraseña del usuario `admin` **solo en su primera creación** |
| `WEB_PORT` | No (default `8081`) | Puerto donde corre `web/` — usado para armar URLs (QR, correos) |
| `WEB_APP_URL` | No | URL pública fija del frontend; si se omite, se arma con la IP LAN detectada + `WEB_PORT` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | No | Credenciales SMTP — sin ellas, `mailer.ts` queda deshabilitado (los envíos se omiten silenciosamente, con aviso en consola) |
| `SMTP_FROM` | No | Remitente mostrado en los correos |
| `SMTP_CC` | No | Correos en copia, separados por coma |

### `web/.env.local` (ver `web/.env.local.example`)

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | Override explícito de la URL de la API; si se omite, se arma en el navegador a partir del host actual + `NEXT_PUBLIC_API_PORT` (ver `lib/api.ts`) |
| `NEXT_PUBLIC_API_PORT` | No (default `8080`) | Puerto de la API, debe coincidir con `PORT` en `api/.env` |
| `PORT` | No (default `8081`) | Puerto en el que Next.js debe escuchar. **Next.js no lee esto de `.env.local`** para elegir su puerto (se carga después de que el CLI ya decidió) — para que surta efecto debe ir como variable de entorno real del proceso (ver `start-web.bat` / `ecosystem.config.js`) |

## Scripts disponibles

**`api/` (`package.json`)**

| Script | Comando | Uso |
|---|---|---|
| `npm run dev` | `tsx watch server.ts` | Desarrollo, recarga automática |
| `npm run build` | `tsc` | Compila `server.ts` y `src/**/*.ts` a `dist/` |
| `npm start` | `node dist/server.js` | Arranca el build de producción (requiere `build` previo) |
| `npm run setup` | `node setup.js` | Crea/actualiza la base de datos (schema + stored procedures + usuario admin) |

**`web/` (`package.json`)**

| Script | Comando | Uso |
|---|---|---|
| `npm run dev` | `next dev` | Desarrollo, recarga automática |
| `npm run build` | `next build` | Compila para producción |
| `npm start` | `next start` | Arranca el build de producción (requiere `build` previo) |
| `npm run lint` | `eslint` | Linting del código |

**Scripts raíz (Windows)**

| Script | Uso |
|---|---|
| `start.bat` | Arranque manual del backend (instala dependencias/BD en la primera corrida, luego compila y arranca) |
| `start-web.bat` | Arranque manual del frontend (requiere `start.bat` corriendo) |
| `abrir-app.bat` | Espera a que el frontend responda y abre `/admin` en el navegador (usado en el arranque de sesión de Windows) |
| `ecosystem.config.js` | Configuración de PM2 para correr backend + frontend como servicios persistentes en producción |
| `setup-servidor.ps1` | Instala Node/PM2/tarea programada para dejar el sistema como servicio permanente en Windows Server |
| `backup.ps1` | Backup diario de la base de datos y de `api/uploads`, invocado por la tarea programada que crea `setup-servidor.ps1` |

## API

Documentación completa (método, parámetros, respuesta y códigos de estado) en TSDoc sobre cada handler, dentro de `api/src/routes/*.ts`. Resumen de endpoints:

**`api/src/routes/auth.ts`** — prefijo `/api/auth`
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/login` | Autentica y emite JWT (12h) |
| POST | `/register` | Crea una solicitud de registro de empleado (pendiente de aprobación) |

**`api/src/routes/tickets.ts`** — prefijo `/api/tickets`
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Lista tickets (propios si es empleado, todos si es staff) |
| POST | `/` | Crea un ticket |
| GET | `/:id` | Consulta un ticket |
| PATCH | `/:id` | Edita campos del ticket (solo staff) |
| DELETE | `/:id` | Elimina un ticket (solo staff) |
| POST | `/:id/comments` | Agrega comentario visible al empleado |
| POST | `/:id/notes` | Agrega nota interna (solo staff) |
| POST | `/:id/attachments` | Sube un adjunto directo (multipart) |
| POST | `/:id/attachments/from-mobile` | Asocia un adjunto subido por QR desde celular |

**`api/src/routes/usuarios.ts`** — prefijo `/api`
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/usuarios` | Lista usuarios con datos personales (requiere permiso `usuarios`) |
| GET | `/usuarios/:id/tickets` | Tickets reportados por un usuario |
| DELETE | `/usuarios/:id` | Elimina un usuario |
| PATCH | `/usuarios/:id/password` | Cambia contraseña de otro usuario (solo superadmin) |
| PATCH | `/usuarios/:id/activo` | Activa/desactiva un usuario |
| PATCH | `/usuarios/:id/permisos` | Otorga/revoca permisos de módulo (solo superadmin) |
| GET | `/usuarios/lista` | Lista ligera para autocompletados |
| GET | `/admins` | Lista el personal del sistema |
| POST | `/admins` | Crea un usuario técnico |
| DELETE | `/admins/:username` | Desactiva un miembro del personal |
| GET | `/solicitudes` | Lista solicitudes de registro |
| POST | `/solicitudes/:id/aprobar` | Aprueba una solicitud (crea la cuenta) |
| POST | `/solicitudes/:id/rechazar` | Rechaza una solicitud |

**`api/src/routes/inventory.ts`** — prefijo `/api`
| Método | Endpoint | Descripción |
|---|---|---|
| GET / POST | `/devices` | Dispositivos recibidos en taller (crea también un ticket asociado) |
| GET / POST | `/inventory` | Inventario de equipos propios |
| PATCH / DELETE | `/inventory/:id` | Edita/elimina un equipo |
| GET / POST | `/loans` | Préstamos de equipo |
| PATCH | `/loans/:id` | Registra devolución (total o parcial) |
| GET | `/auditoria` | Bitácora de auditoría con filtros |

**`api/src/routes/mobileUpload.ts`** — prefijo `/api/mobile-upload` (sin autenticación, por diseño)
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/session` | Crea una sesión de subida efímera (5 min) |
| GET | `/qr/:token` | Genera el QR (PNG) que apunta a `/mobile-upload` |
| POST | `/:token` | Recibe el archivo subido desde el celular |
| GET | `/status/:token` | Consulta si el archivo ya llegó |

## Base de datos

SQL Server. El esquema completo (con comentarios de relaciones) está en `api/schema.sql`; los stored procedures en `api/procedimientos.sql` (índice con la lista completa al inicio del archivo).

**Entidades principales y relaciones:**

```
roles 1───* usuarios *───1 departamentos
usuarios 1───* tickets (reporter_id, asignado_id)
tickets 1───* comentarios / historial_tickets / adjuntos   (ON DELETE CASCADE)
tickets 1───1 dispositivos (device_id — equipo recibido en taller)
usuarios 1───* inventario (responsable_id)
inventario 1───* historial_inventario
inventario 1───* prestamos *───1 usuarios (empleado_id, autorizado_por_id)
solicitudes_registro *───1 usuarios (revisado_por)
auditoria — bitácora independiente, sin FKs (sobrevive aunque se borre la entidad referenciada)
contadores — secuencias para los folios legibles (TK-001, INV-001, PREST-001, DEV-001)
```

Las claves de las entidades de negocio (`tickets`, `inventario`, `prestamos`, `dispositivos`) son folios legibles (`NVARCHAR`) generados por `db.nextId()`, no IDs autoincrementales — ver `api/src/db.ts`.

## Flujo de funcionamiento

1. **Login**: el empleado entra a `/portal` y el staff a `/admin`; ambos comparten el mismo endpoint `POST /api/auth/login`, pero el campo `portal` en el body evita que un empleado entre por el panel admin (y viceversa). El servidor responde con un JWT (12h) y los permisos de módulo del usuario, que el frontend guarda en `sessionStorage`.
2. **Portal de empleados**: el empleado crea un ticket (con adjunto opcional, subido directo o vía QR desde el celular) y ve solo sus propios tickets, con posibilidad de responder a los comentarios de soporte.
3. **Panel admin — Tickets**: el staff ve todos los tickets, los asigna, cambia de estado, responde al empleado (comentarios) o deja notas internas (invisibles para el empleado), y recibe notificaciones en vivo de tickets nuevos.
4. **Panel admin — Inventario**: de forma independiente (requiere permiso otorgado por el superadmin), el staff gestiona equipos (por unidad o por lote), registra préstamos a empleados y sus devoluciones (totales o parciales), generando comprobantes imprimibles en Word.
5. **Panel admin — Usuarios**: el superadmin (o quien tenga el permiso `usuarios`) aprueba o rechaza las solicitudes de registro pendientes, gestiona cuentas (activar/desactivar/eliminar) y otorga permisos de módulo a técnicos/admins.
6. **Bitácora**: cada acción administrativa relevante (crear/editar/eliminar, aprobar solicitudes, cambios de permisos, etc.) queda registrada en la tabla `auditoria`, consultable con filtros desde `/admin/auditoria`.
7. **Notificaciones por correo** (si SMTP está configurado): al administrador cuando llega una solicitud o un ticket nuevo, y al empleado cuando cambia el estado de su ticket.

## Capturas sugeridas

El repositorio no incluye capturas de pantalla. Para documentación visual, se sugiere capturar:

- Pantalla de login (`/portal` y `/admin`)
- Portal de empleados: listado de "mis tickets" y modal de nuevo ticket
- Panel admin: bandeja de tickets con filtros y gráficos
- Detalle de ticket (drawer) con historial y notas internas
- Módulo de inventario: dashboard, listado de equipos y modal de préstamo
- Gestión de usuarios: listado y modal de aprobación de solicitudes
- Bitácora de auditoría

## Posibles mejoras

Hallazgos de revisión de código — no se modificó nada, solo se documentan como sugerencias:

- **`api/procedimientos.sql`** termina con un `select * from usuarios;` suelto (línea final) que no forma parte de ningún procedimiento — parece un resto de depuración. `setup.js` lo ejecuta como un batch más al correr `npm run setup`; el resultado se descarta, así que es inofensivo, pero conviene eliminarlo para mantener el script limpio.
- **Acceso a datos mixto**: la mayoría de las rutas usan stored procedures (`db.exec`), pero varias (`tickets.ts`, `usuarios.ts`) todavía arman SQL inline con sintaxis MySQL que `db.ts` traduce a T-SQL en cada llamada (`toTSQL`). Migrar esas queries a stored procedures uniformaría el patrón de acceso a datos y evitaría el costo (menor, pero innecesario) de la traducción por regex en cada request.
- **`DELETE /api/usuarios/:id`** desvincula manualmente al usuario de ~9 tablas con sentencias `UPDATE` sueltas, sin transacción — a diferencia de `sp_AprobarSolicitud`/`sp_RechazarSolicitud`/`sp_CrearDispositivoConTicket`, que sí envuelven sus pasos en `BEGIN TRANSACTION`. Si una de esas actualizaciones falla a mitad de camino, el usuario podría quedar parcialmente desvinculado. Convertir esta operación en un stored procedure transaccional (como las demás operaciones multi-paso) eliminaría ese riesgo.
- **Duplicación entre `QRModal.tsx` (portal) y `QRPhotoModal.tsx` (admin/inventario)**: implementan el mismo mecanismo de sesión + polling + cuenta regresiva casi línea por línea, solo cambia el texto y algunos estilos. Se podría extraer un hook compartido (ej. `useMobileUploadSession`) y dejar que cada componente solo aporte el texto/estilo específico.
- **Duplicación entre `generateLoanWord.ts` y `generateReturnWord.ts`**: comparten casi todo el membrete y la estructura HTML del documento; solo cambian los datos mostrados. Un helper común para el encabezado/pie de página reduciría la duplicación.
- **`ReturnConfirmModal` y `PartialReturnModal`** (en `ReturnModals.tsx`) repiten la misma estructura de campos (condición, nota) y botones de footer; podrían compartir un subcomponente para esa porción del formulario.
- **Botones de modal repetidos**: la clase Tailwind larga de los botones "Cancelar"/"Confirmar" de los modales (ver `AdminManagerModal`, `InventoryModal`, `LoanModal`, `ReturnModals`, `NewTicketModal`, `QRModal`, `QRPhotoModal`, `UserDetailModal`) se repite casi idéntica en cada archivo. Extraerlos como componentes `ModalButton`/`ModalCancelButton` en `components/ui` reduciría la duplicación y facilitaría un cambio de estilo futuro.
- **Sesiones de subida móvil en memoria** (`api/src/mobileSessions.ts`): al vivir en un `Map` del proceso, se pierden si el backend se reinicia o si en el futuro se despliega con más de una instancia (PM2 cluster, balanceo de carga). Es adecuado para el despliegue actual (un solo proceso, ver `ecosystem.config.js`), pero es una limitante a tener en cuenta si el sistema crece.
- **Revocación de sesión**: cerrar sesión solo borra el JWT del `sessionStorage` del navegador; el token en sí sigue siendo válido hasta su expiración (12h) si alguien lo copiara antes del logout. No hay una lista de revocación ni invalidación server-side. Igual de acotado a considerar: cambiar la contraseña de un usuario no invalida sus tokens ya emitidos.

## Autor

Grupo Milcien S.A. de C.V. — Departamento de Sistemas / TI.
