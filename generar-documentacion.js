const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT = path.join(__dirname, 'GCM-Tickets-Documentacion.pdf');
const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
doc.pipe(fs.createWriteStream(OUT));

// ── Paleta ───────────────────────────────────────────────────────
const AZUL      = '#1a3c6e';
const AZUL_CLARO= '#2563eb';
const GRIS      = '#64748b';
const GRIS_FONDO= '#f1f5f9';
const NEGRO     = '#1e293b';
const BLANCO    = '#ffffff';
const VERDE     = '#16a34a';
const ROJO      = '#dc2626';

// ── Helpers ──────────────────────────────────────────────────────
function lineaH(y, color = '#cbd5e1', grosor = 0.5) {
  doc.moveTo(60, y).lineTo(535, y).lineWidth(grosor).strokeColor(color).stroke();
}

function cajaTitulo(texto, y) {
  doc.rect(60, y, 475, 28).fill(AZUL);
  doc.fontSize(12).fillColor(BLANCO).font('Helvetica-Bold')
     .text(texto, 70, y + 8);
  doc.fillColor(NEGRO).font('Helvetica');
  return y + 40;
}

function seccion(titulo, y) {
  if (y > 700) { doc.addPage(); y = 60; }
  doc.fontSize(13).fillColor(AZUL).font('Helvetica-Bold').text(titulo, 60, y);
  lineaH(y + 17, AZUL_CLARO, 1);
  doc.fillColor(NEGRO).font('Helvetica').fontSize(10);
  return y + 25;
}

function parrafo(texto, y, indent = 0) {
  if (y > 730) { doc.addPage(); y = 60; }
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica')
     .text(texto, 60 + indent, y, { width: 475 - indent, lineGap: 3 });
  return y + doc.heightOfString(texto, { width: 475 - indent }) + 8;
}

function itemLista(texto, y, color = NEGRO) {
  if (y > 730) { doc.addPage(); y = 60; }
  doc.circle(72, y + 4, 2.5).fill(AZUL_CLARO);
  doc.fontSize(10).fillColor(color).font('Helvetica')
     .text(texto, 82, y, { width: 453, lineGap: 2 });
  const h = doc.heightOfString(texto, { width: 453 });
  return y + Math.max(h, 12) + 4;
}

function filaTabla(col1, col2, y, sombreado = false) {
  if (y > 740) { doc.addPage(); y = 60; }
  if (sombreado) doc.rect(60, y, 475, 18).fill(GRIS_FONDO);
  doc.fontSize(9.5).fillColor(NEGRO).font(sombreado ? 'Helvetica' : 'Helvetica')
     .text(col1, 65, y + 4, { width: 180 })
     .text(col2, 255, y + 4, { width: 275 });
  lineaH(y + 18, '#e2e8f0', 0.3);
  return y + 19;
}

function cabeceraTabla(col1, col2, y) {
  doc.rect(60, y, 475, 20).fill(AZUL);
  doc.fontSize(10).fillColor(BLANCO).font('Helvetica-Bold')
     .text(col1, 65, y + 5, { width: 180 })
     .text(col2, 255, y + 5, { width: 275 });
  return y + 21;
}

function badge(texto, x, y, color = AZUL_CLARO) {
  const w = doc.widthOfString(texto, { fontSize: 8 }) + 14;
  doc.roundedRect(x, y, w, 14, 3).fill(color);
  doc.fontSize(8).fillColor(BLANCO).font('Helvetica-Bold').text(texto, x + 7, y + 3);
  doc.fillColor(NEGRO).font('Helvetica');
  return x + w + 6;
}

// ═══════════════════════════════════════════════════════════════
// PORTADA
// ═══════════════════════════════════════════════════════════════
doc.rect(0, 0, 595, 842).fill(AZUL);
doc.rect(0, 680, 595, 162).fill('#0f2347');

// Logo / ícono decorativo
doc.circle(297, 180, 70).fill('#1e4d8c').stroke();
doc.circle(297, 180, 55).lineWidth(2).strokeColor('#3b82f6').stroke();
doc.fontSize(48).fillColor(BLANCO).font('Helvetica-Bold').text('GCM', 245, 158);

doc.fontSize(28).fillColor(BLANCO).font('Helvetica-Bold')
   .text('GCM TICKETS', 60, 290, { align: 'center', width: 475 });

doc.fontSize(16).fillColor('#93c5fd').font('Helvetica')
   .text('Sistema de Soporte Técnico', 60, 328, { align: 'center', width: 475 });

doc.moveTo(160, 360).lineTo(435, 360).lineWidth(1).strokeColor('#3b82f6').stroke();

doc.fontSize(12).fillColor('#cbd5e1').font('Helvetica')
   .text('Documentación Técnica y de Funcionamiento', 60, 375, { align: 'center', width: 475 });

// Info portada
const portadaInfo = [
  ['Versión', '2.0.0'],
  ['Fecha', new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })],
  ['Servidor', 'Windows Server 2022 Datacenter'],
  ['IP del Servidor', '10.0.1.108'],
];
let py = 440;
portadaInfo.forEach(([lbl, val]) => {
  doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text(lbl + ':', 120, py);
  doc.fontSize(10).fillColor(BLANCO).font('Helvetica-Bold').text(val, 240, py);
  py += 22;
});

doc.fontSize(9).fillColor('#64748b').font('Helvetica')
   .text('CONFIDENCIAL — Uso interno', 60, 730, { align: 'center', width: 475 });

// ═══════════════════════════════════════════════════════════════
// PÁGINA 2 — Índice
// ═══════════════════════════════════════════════════════════════
doc.addPage();
let y = 60;

doc.fontSize(20).fillColor(AZUL).font('Helvetica-Bold').text('Contenido', 60, y);
lineaH(y + 26, AZUL, 1.5);
y += 40;

const indice = [
  ['1.', 'Resumen Ejecutivo', '3'],
  ['2.', 'Especificaciones del Servidor', '3'],
  ['3.', 'Software Instalado', '4'],
  ['4.', 'Arquitectura de la Aplicación', '4'],
  ['5.', 'Configuración del Servidor', '5'],
  ['6.', 'Funcionalidades del Sistema', '6'],
  ['7.', 'Roles y Permisos de Usuario', '7'],
  ['8.', 'Gestión de Archivos (Imágenes y Videos)', '8'],
  ['9.', 'Acceso al Sistema', '8'],
  ['10.', 'Respaldo y Recuperación', '9'],
  ['11.', 'Mantenimiento y Comandos', '9'],
  ['12.', 'Seguridad', '10'],
];

indice.forEach(([num, titulo, pag]) => {
  doc.fontSize(11).fillColor(AZUL).font('Helvetica-Bold').text(num, 70, y);
  doc.fillColor(NEGRO).font('Helvetica').text(titulo, 95, y);
  doc.fillColor(GRIS).text(pag, 0, y, { align: 'right', width: 475 });
  lineaH(y + 16, '#e2e8f0', 0.3);
  y += 22;
});

// ═══════════════════════════════════════════════════════════════
// PÁGINAS DE CONTENIDO
// ═══════════════════════════════════════════════════════════════
doc.addPage();
y = 60;

// Encabezado de página
function encabezadoPagina(titulo) {
  doc.rect(60, 40, 475, 1).fill(AZUL);
  doc.fontSize(8).fillColor(GRIS).font('Helvetica')
     .text('GCM TICKETS — Documentación Técnica', 60, 28)
     .text(new Date().getFullYear().toString(), 0, 28, { align: 'right', width: 475 });
}

// ─── 1. Resumen Ejecutivo ────────────────────────────────────────
y = cajaTitulo('1. Resumen Ejecutivo', y);

y = parrafo(
  'GCM Tickets es un sistema web de gestión de tickets de soporte técnico diseñado para operar en red local. ' +
  'Permite a los empleados reportar incidencias, solicitar soporte y dar seguimiento a sus casos, mientras el ' +
  'equipo de soporte técnico gestiona, asigna y resuelve las solicitudes desde un panel de administración centralizado.',
  y
);

y = parrafo(
  'El sistema se ejecuta sobre una máquina virtual con Windows Server 2022 que actúa como servidor único para ' +
  'la aplicación web y la base de datos, siendo accesible desde cualquier equipo de la red.',
  y
);

y += 10;

// ─── 2. Especificaciones del Servidor ───────────────────────────
y = cajaTitulo('2. Especificaciones del Servidor', y);

y = cabeceraTabla('Componente', 'Valor', y);
const specs = [
  ['Sistema Operativo', 'Windows Server 2022 Datacenter Evaluation'],
  ['Procesador', 'Intel Core i5-12450H — 2 núcleos / 2 hilos (VM)'],
  ['Memoria RAM', '10 GB DDR4'],
  ['Disco Principal (C:)', '69 GB — 50 GB disponibles'],
  ['Dirección IP', '10.0.1.108 (estática)'],
  ['Puerto de la Aplicación', '3000 (TCP)'],
  ['Puerto SQL Server', '1433 (TCP)'],
  ['Tipo de Red', 'Ethernet — Subred 10.0.1.0/23'],
  ['Gateway', '10.0.1.1'],
];
specs.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 12;

// ─── 3. Software Instalado ───────────────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('3. Software Instalado', y);

y = cabeceraTabla('Software', 'Versión / Detalle', y);
const sw = [
  ['Node.js', 'v20.18.0 (LTS)'],
  ['npm', '10.8.2'],
  ['PM2 (Process Manager)', 'v7.0.3 — Gestor de procesos Node.js'],
  ['pm2-logrotate', 'Rotación automática de logs (10 MB / 7 días)'],
  ['SQL Server', 'Microsoft SQL Server (MSSQLSERVER) — Automático'],
  ['SQL Server Browser', 'Habilitado y automático'],
  ['Express.js', 'v4.18.2 — Framework web'],
  ['mssql', 'v12.5.5 — Driver SQL Server para Node.js'],
  ['bcrypt', 'v5.1.1 — Hash de contraseñas'],
  ['multer', 'v2.1.1 — Subida de archivos'],
  ['nodemailer', 'v8.0.11 — Envío de correos'],
  ['qrcode', 'v1.5.4 — Generación de códigos QR'],
];
sw.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 12;

// ─── 4. Arquitectura ────────────────────────────────────────────
y = cajaTitulo('4. Arquitectura de la Aplicación', y);

y = parrafo('El sistema sigue una arquitectura cliente-servidor de tres capas:', y);

const capas = [
  ['Capa de Presentación', 'HTML5 + CSS3 + JavaScript vanilla. Archivos estáticos servidos por Express desde la carpeta /public.'],
  ['Capa de Aplicación', 'Node.js + Express.js corriendo en el puerto 3000, gestionado por PM2.'],
  ['Capa de Datos', 'Microsoft SQL Server con stored procedures para toda la lógica de negocio en la base de datos gcm_tickets.'],
];

capas.forEach(([titulo, desc]) => {
  if (y > 720) { doc.addPage(); y = 60; }
  doc.fontSize(10).fillColor(AZUL_CLARO).font('Helvetica-Bold').text(titulo, 70, y);
  y += 14;
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica')
     .text(desc, 82, y, { width: 453, lineGap: 2 });
  y += doc.heightOfString(desc, { width: 453 }) + 8;
});

y += 6;
y = parrafo('Estructura de directorios del proyecto:', y);

const dirs = [
  '/SistemaApp/server.js        — Punto de entrada del servidor',
  '/SistemaApp/src/             — Lógica del servidor (rutas, DB, helpers)',
  '/SistemaApp/src/routes/      — Endpoints REST (auth, tickets, usuarios, inventario)',
  '/SistemaApp/public/          — Frontend (HTML, CSS, JavaScript del cliente)',
  '/SistemaApp/uploads/         — Archivos subidos (imágenes y videos de tickets)',
  '/SistemaApp/logs/            — Logs de PM2',
  '/SistemaApp/backup.ps1       — Script de respaldo automático',
  '/SistemaApp/ecosystem.config.js — Configuración de PM2',
];
dirs.forEach(d => { y = itemLista(d, y, GRIS); });

// ─── 5. Configuración del Servidor ──────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('5. Configuración del Servidor', y);

y = seccion('5.1 Inicio Automático de la Aplicación', y);
y = parrafo(
  'La aplicación se gestiona con PM2 y arranca automáticamente al iniciar Windows mediante una tarea ' +
  'programada en el Programador de tareas (Task Scheduler) llamada "PM2-GCM-Tickets". ' +
  'Esta tarea ejecuta "pm2 resurrect" con el usuario SYSTEM al inicio del sistema, restaurando todos los ' +
  'procesos guardados con "pm2 save".',
  y
);
y += 8;

y = seccion('5.2 Variables de Entorno (.env)', y);

y = cabeceraTabla('Variable', 'Valor / Descripción', y);
const envVars = [
  ['DB_SERVER', 'localhost'],
  ['DB_PORT', '1433'],
  ['DB_USER', 'sa'],
  ['DB_PASSWORD', '(configurada en .env — no mostrar)'],
  ['DB_NAME', 'gcm_tickets'],
  ['PORT', '3000'],
  ['NODE_ENV', 'production'],
  ['APP_URL', 'http://10.0.1.108:3000'],
  ['BCRYPT_ROUNDS', '12 (factor de costo hash de contraseñas)'],
  ['SESSION_SECRET', '(clave secreta de sesión — no mostrar)'],
  ['SMTP_HOST / USER / PASS', 'Configuración de correo (opcional)'],
];
envVars.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 12;

y = seccion('5.3 Firewall de Windows', y);
const fw = [
  'Puerto 3000 TCP — Acceso a la aplicación web (entrada, perfil Any)',
  'Puerto 1433 TCP — Acceso a SQL Server (entrada, perfil Any)',
];
fw.forEach(f => { y = itemLista(f, y); });
y += 6;

y = seccion('5.4 IP Estática', y);
y = parrafo(
  'La interfaz Ethernet0 tiene configurada la IP 10.0.1.108/23 de forma estática (tipo Manual), ' +
  'garantizando que la dirección no cambie entre reinicios y que las URLs de acceso permanezcan constantes.',
  y
);

// ─── 6. Funcionalidades ─────────────────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('6. Funcionalidades del Sistema', y);

const funcionalidades = [
  {
    titulo: '6.1 Gestión de Tickets',
    items: [
      'Creación de tickets por parte de empleados con categoría, prioridad y descripción',
      'Adjuntar imágenes y videos como evidencia (hasta 50 MB por archivo)',
      'Asignación de tickets a técnicos de soporte',
      'Cambio de estado: Abierto → En Proceso → Resuelto → Cerrado',
      'Comentarios internos y respuestas al usuario en cada ticket',
      'Historial completo de cambios y actividad por ticket',
      'Filtros por estado, prioridad, técnico asignado y fecha',
    ],
  },
  {
    titulo: '6.2 Panel de Administración',
    items: [
      'Dashboard con métricas: tickets abiertos, en proceso, resueltos y cerrados',
      'Gestión completa de usuarios (crear, editar, aprobar, desactivar)',
      'Aprobación de solicitudes de registro de nuevos empleados',
      'Asignación de roles y departamentos',
      'Gestión de inventario de equipos y activos',
      'Exportación de reportes',
      'Configuración de departamentos y categorías',
    ],
  },
  {
    titulo: '6.3 Panel de Empleado (Usuario)',
    items: [
      'Registro con solicitud de aprobación por el administrador',
      'Creación y seguimiento de tickets propios',
      'Subida de archivos multimedia como evidencia',
      'Subida de imágenes y videos desde dispositivos móviles via código QR',
      'Notificaciones de cambio de estado en sus tickets',
      'Perfil de usuario editable',
    ],
  },
  {
    titulo: '6.4 Carga desde Dispositivos Móviles',
    items: [
      'El sistema genera un código QR único por ticket',
      'El empleado escanea el QR con su celular',
      'Puede subir fotos o videos directamente desde la cámara del celular',
      'Los archivos se asocian automáticamente al ticket correspondiente',
    ],
  },
  {
    titulo: '6.5 Inventario',
    items: [
      'Registro de equipos y activos de la empresa',
      'Asignación de equipos a empleados o departamentos',
      'Control de estado y ubicación de activos',
    ],
  },
];

funcionalidades.forEach(({ titulo, items }) => {
  if (y > 680) { doc.addPage(); y = 60; }
  y = seccion(titulo, y);
  items.forEach(item => { y = itemLista(item, y); });
  y += 8;
});

// ─── 7. Roles ───────────────────────────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('7. Roles y Permisos de Usuario', y);

y = cabeceraTabla('Rol', 'Descripción y Permisos', y);
const roles = [
  ['Superadmin (nivel 4)', 'Acceso total al sistema. Gestiona usuarios, roles, configuración y todos los tickets.'],
  ['Admin (nivel 3)', 'Administra tickets, aprueba registros, gestiona inventario y genera reportes.'],
  ['Técnico (nivel 2)', 'Recibe asignaciones, actualiza estado de tickets y agrega comentarios técnicos.'],
  ['Usuario (nivel 1)', 'Crea tickets propios, sube archivos y consulta el estado de sus solicitudes.'],
];
roles.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 14;

y = parrafo(
  'Los nuevos empleados deben solicitar registro desde la página usuario.html. Su cuenta queda pendiente ' +
  'hasta que un administrador la apruebe desde el panel de administración.',
  y
);

// ─── 8. Archivos ────────────────────────────────────────────────
y += 10;
y = cajaTitulo('8. Gestión de Archivos (Imágenes y Videos)', y);

y = parrafo(
  'Los archivos multimedia NO se almacenan en la base de datos SQL Server. Se guardan en disco en la ' +
  'siguiente ruta del servidor:',
  y
);

doc.rect(60, y, 475, 24).fill(GRIS_FONDO);
doc.fontSize(10).fillColor(AZUL).font('Courier-Bold')
   .text('C:\\Users\\Administrador\\SistemaApp\\uploads\\', 70, y + 7);
doc.fillColor(NEGRO).font('Helvetica');
y += 34;

y = parrafo('En la base de datos solo se guarda la referencia (nombre del archivo). Detalles:', y);

const archivos = [
  ['Formatos soportados', 'JPG, JPEG, PNG, GIF, WEBP (imágenes) / MP4, MOV, AVI, WEBM, 3GP (video)'],
  ['Tamaño máximo', '50 MB por archivo'],
  ['Nomenclatura (web)', '{id_ticket}-{timestamp}.{ext}'],
  ['Nomenclatura (móvil)', 'mob-{token}-{timestamp}.{ext}'],
  ['Acceso URL', 'http://10.0.1.108:3000/uploads/{nombre_archivo}'],
];
y = cabeceraTabla('Parámetro', 'Valor', y);
archivos.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });

// ─── 9. Acceso ──────────────────────────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('9. Acceso al Sistema', y);

y = seccion('9.1 URLs de Acceso', y);
y = cabeceraTabla('Panel', 'URL', y);
const urls = [
  ['Administración (local)', 'http://localhost:3000/admin.html'],
  ['Empleados (local)', 'http://localhost:3000/usuario.html'],
  ['Administración (red)', 'http://10.0.1.108:3000/admin.html'],
  ['Empleados (red)', 'http://10.0.1.108:3000/usuario.html'],
];
urls.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 14;

y = seccion('9.2 Credenciales Iniciales', y);
doc.rect(60, y, 475, 60).fill('#fef3c7');
doc.rect(60, y, 4, 60).fill('#f59e0b');
doc.fontSize(9).fillColor('#92400e').font('Helvetica-Bold')
   .text('IMPORTANTE: Cambiar la contraseña del administrador después del primer acceso.', 72, y + 8, { width: 455 });
doc.fillColor(NEGRO).font('Helvetica')
   .text('Usuario: admin', 72, y + 24)
   .text('Contraseña inicial: admin123', 72, y + 38);
y += 72;

y = seccion('9.3 Acceso desde Internet', y);
y = parrafo(
  'Para acceder desde fuera de la red local, se debe configurar el reenvío de puertos (Port Forwarding) ' +
  'en el router/gateway de la red, dirigiendo el puerto 3000 externo hacia la IP 10.0.1.108 interna.',
  y
);
y = itemLista('Puerto externo: 3000 → IP interna: 10.0.1.108 → Puerto destino: 3000', y);
y = itemLista('URL externa: http://{IP-PÚBLICA}:3000/admin.html', y);

// ─── 10. Respaldo ───────────────────────────────────────────────
y += 10;
y = cajaTitulo('10. Respaldo y Recuperación', y);

y = parrafo(
  'El sistema tiene configurado un proceso de respaldo automático diario mediante una tarea programada ' +
  'en el Programador de Tareas de Windows llamada "GCM-Tickets-Backup-Diario".',
  y
);
y += 6;

y = cabeceraTabla('Parámetro', 'Valor', y);
const backupInfo = [
  ['Hora de ejecución', '2:00 AM todos los días'],
  ['Ruta de destino', 'C:\\Backups\\GCM-Tickets\\{YYYY-MM-DD}\\'],
  ['Contenido del backup', 'Archivo .BAK de SQL Server + .ZIP de la carpeta uploads'],
  ['Retención', '7 días (los más antiguos se eliminan automáticamente)'],
  ['Nombre BD backup', 'gcm_tickets_{fecha}.bak'],
  ['Nombre uploads backup', 'uploads_{fecha}.zip'],
];
backupInfo.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 12;

y = parrafo(
  'Para restaurar la base de datos manualmente desde un backup, ejecutar en SQL Server Management Studio:',
  y
);
doc.rect(60, y, 475, 30).fill(GRIS_FONDO);
doc.fontSize(9).fillColor(AZUL).font('Courier')
   .text("RESTORE DATABASE gcm_tickets FROM DISK = 'C:\\Backups\\GCM-Tickets\\{fecha}\\gcm_tickets_{fecha}.bak'", 68, y + 5, { width: 460 })
   .text("WITH REPLACE, RECOVERY;", 68, y + 18);
doc.fillColor(NEGRO).font('Helvetica');
y += 42;

// ─── 11. Mantenimiento ──────────────────────────────────────────
doc.addPage(); y = 60;
y = cajaTitulo('11. Mantenimiento y Comandos', y);

y = seccion('11.1 Comandos PM2', y);
y = cabeceraTabla('Comando', 'Descripción', y);
const cmds = [
  ['pm2 list', 'Ver estado de todos los procesos'],
  ['pm2 logs gcm-tickets', 'Ver logs en tiempo real'],
  ['pm2 restart gcm-tickets', 'Reiniciar la aplicación'],
  ['pm2 stop gcm-tickets', 'Detener la aplicación'],
  ['pm2 start gcm-tickets', 'Iniciar la aplicación'],
  ['pm2 monit', 'Monitor visual de CPU y memoria'],
  ['pm2 save', 'Guardar estado actual de los procesos'],
  ['pm2 flush', 'Limpiar todos los logs de PM2'],
];
cmds.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });
y += 12;

y = seccion('11.2 Actualizaciones del Sistema', y);
const actualizaciones = [
  'Detener la app: pm2 stop gcm-tickets',
  'Aplicar cambios al código fuente',
  'Si cambian dependencias: npm install',
  'Reiniciar la app: pm2 restart gcm-tickets',
  'Verificar logs: pm2 logs gcm-tickets',
];
actualizaciones.forEach((paso, i) => {
  doc.circle(72, y + 4, 8).fill(AZUL);
  doc.fontSize(8).fillColor(BLANCO).font('Helvetica-Bold').text((i + 1).toString(), i < 9 ? 69 : 67, y + 0);
  doc.fontSize(10).fillColor(NEGRO).font('Helvetica').text(paso, 88, y, { width: 447 });
  doc.fillColor(NEGRO).font('Helvetica');
  y += 20;
});

y += 8;
y = seccion('11.3 Monitoreo de Recursos', y);
const monitoreo = [
  'Verificar espacio en disco regularmente — los uploads crecen con el uso',
  'Revisar logs de PM2 ante cualquier fallo de la aplicación',
  'Monitorear el uso de RAM con pm2 monit si la app se vuelve lenta',
  'SQL Server: verificar el tamaño de la base de datos gcm_tickets periódicamente',
];
monitoreo.forEach(m => { y = itemLista(m, y); });

// ─── 12. Seguridad ──────────────────────────────────────────────
y += 10;
y = cajaTitulo('12. Seguridad', y);

if (y > 680) { doc.addPage(); y = 60; }

const seguridad = [
  ['Contraseñas hasheadas', 'bcrypt con 12 rondas de costo. Las contraseñas nunca se almacenan en texto plano.'],
  ['Credenciales en .env', 'El archivo .env está excluido del repositorio git (.gitignore). No se versiona.'],
  ['Firewall configurado', 'Solo los puertos 3000 y 1433 están abiertos para tráfico entrante.'],
  ['Cambiar contraseña admin', 'La contraseña inicial "admin123" debe cambiarse al primer acceso.'],
  ['Actualizaciones del SO', 'Mantener Windows Server actualizado mediante Windows Update.'],
  ['Acceso SQL Server', 'El usuario "sa" tiene contraseña fuerte. No exponer el puerto 1433 a internet.'],
  ['Backups cifrados', 'Considerar cifrar los archivos de backup si contienen información sensible.'],
  ['HTTPS', 'Para acceso externo por internet, implementar un certificado SSL/TLS (ej. Let\'s Encrypt + nginx).'],
];

y = cabeceraTabla('Medida', 'Descripción', y);
seguridad.forEach(([c1, c2], i) => { y = filaTabla(c1, c2, y, i % 2 === 0); });

// ─── Pie de página en última hoja ───────────────────────────────
y += 20;
lineaH(y, AZUL, 1);
y += 8;
doc.fontSize(8).fillColor(GRIS).font('Helvetica')
   .text(
     `Documento generado el ${new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} — GCM Tickets v2.0.0`,
     60, y, { align: 'center', width: 475 }
   );

doc.end();
console.log(`\nDocumento generado: ${OUT}\n`);
