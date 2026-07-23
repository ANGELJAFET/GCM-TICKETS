/**
 * Punto de entrada de la API (GCM Tickets).
 *
 * Responsabilidades de este archivo:
 * - Configurar middlewares globales (CORS, seguridad HTTP con helmet, parseo de JSON).
 * - Servir los adjuntos subidos (`/uploads`) como archivos estáticos.
 * - Montar los routers de cada dominio bajo sus prefijos `/api/*`.
 * - Inicializar el pool de conexión a SQL Server (`db.initDB`) y, una vez listo,
 *   levantar el servidor HTTP en el puerto configurado (`PORT`).
 *
 * No contiene lógica de negocio: solo bootstrap/orquestación. La lógica de cada
 * dominio vive en `src/routes/*.ts`.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';

import db from './src/db';
import { UPLOADS, PORT, WEB_PORT } from './src/config';
import { getLocalIP } from './src/helpers';

import authRoutes         from './src/routes/auth';
import ticketRoutes       from './src/routes/tickets';
import usuarioRoutes      from './src/routes/usuarios';
import inventoryRoutes    from './src/routes/inventory';
import mobileUploadRoutes from './src/routes/mobileUpload';

// Asegura que exista el directorio de adjuntos antes de servirlo/escribir en él.
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const app = express();
// El frontend (web/) es un origen distinto al backend, y se accede desde
// cualquier dispositivo de la red LAN por IP (ej. el celular escaneando el
// QR de subida de evidencia) — no hay un único origen fijo que "conocer" de
// antemano. La autenticación va por Bearer token en el header Authorization
// (no por cookies), así que reflejar el origen no habilita CSRF: un sitio
// externo no tiene forma de obtener el token para adjuntarlo a sus llamadas.
app.use(cors({ origin: true }));
// contentSecurityPolicy: este servidor solo expone JSON + archivos estáticos de
// /uploads, nunca HTML propio, así que la CSP por defecto de helmet (pensada
// para páginas) no aplica y solo podría interferir. crossOriginResourcePolicy
// se relaja porque el frontend (otro origen/puerto) carga imágenes/videos de
// /uploads directamente en <img>/<video>.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Esta app se sirve por HTTP puro en la red local (sin certificado TLS).
  // El HSTS por defecto de helmet le dice al navegador "usa siempre HTTPS
  // con este host de ahora en adelante" — como no hay HTTPS, cualquier
  // dispositivo que reciba ese header queda incapaz de volver a conectarse
  // por HTTP hasta que expire o se borre manualmente (esto rompió el QR de
  // subida desde celular). Desactivado a propósito.
  hsts: false,
}));
app.use(express.json());
// Expone los archivos subidos (fotos de tickets, evidencias, etc.) como
// contenido estático servido directamente desde el filesystem.
app.use('/uploads', express.static(UPLOADS));

// Todas las respuestas de /api quedan sin cachear: el panel admin y el portal
// muestran datos que cambian constantemente (tickets, inventario), así que no
// conviene que el navegador o un proxy sirvan una respuesta vieja.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// Montaje de routers por dominio. Ver cada archivo en src/routes/ para el
// detalle de endpoints, parámetros y respuestas.
app.use('/api/auth',          authRoutes);       // login, registro, sesión
app.use('/api/tickets',       ticketRoutes);     // CRUD de tickets
app.use('/api',               usuarioRoutes);    // usuarios, solicitudes, permisos
app.use('/api',               inventoryRoutes);  // inventario, préstamos, bitácora
app.use('/api/mobile-upload', mobileUploadRoutes); // adjuntos desde celular vía QR

// El servidor HTTP solo arranca una vez que el pool de SQL Server está listo:
// si la BD no responde, no tiene sentido aceptar peticiones que fallarían todas.
db.initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n========================================');
    console.log('   GCM TICKETS - API ACTIVA');
    console.log('========================================');
    console.log('');
    console.log(`  API escuchando en el puerto ${PORT}.`);
    console.log(`  El frontend (web/) debe correr por separado en el puerto ${WEB_PORT}.`);
    console.log('');
    console.log('  Acceso local (este equipo):');
    console.log(`    http://localhost:${WEB_PORT}/admin`);
    console.log(`    http://localhost:${WEB_PORT}/portal`);
    if (localIP !== 'localhost') {
      console.log('');
      console.log('  Acceso desde otros equipos en la red:');
      console.log(`    http://${localIP}:${WEB_PORT}/admin   <- Soporte técnico`);
      console.log(`    http://${localIP}:${WEB_PORT}/portal  <- Empleados`);
    }
    console.log('');
    console.log('  Para detener el servidor: Ctrl + C');
    console.log('========================================\n');
  });
}).catch(err => {
  console.error('Error fatal al iniciar:', err);
  process.exit(1);
});
