import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';

import db from './src/db';
import { UPLOADS, PORT, WEB_PORT } from './src/config';
import { getLocalIP } from './src/helpers';

import authRoutes         from './src/routes/auth';
import ticketRoutes       from './src/routes/tickets';
import usuarioRoutes      from './src/routes/usuarios';
import inventoryRoutes    from './src/routes/inventory';
import mobileUploadRoutes from './src/routes/mobileUpload';

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const app = express();
// El frontend (web/) es un origen distinto al backend, y se accede desde
// cualquier dispositivo de la red LAN por IP (ej. el celular escaneando el
// QR de subida de evidencia) — no hay un único origen fijo que "conocer" de
// antemano. La autenticación va por Bearer token en el header Authorization
// (no por cookies), así que reflejar el origen no habilita CSRF: un sitio
// externo no tiene forma de obtener el token para adjuntarlo a sus llamadas.
app.use(cors({ origin: true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

app.use('/api/auth',          authRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api',               usuarioRoutes);
app.use('/api',               inventoryRoutes);
app.use('/api/mobile-upload', mobileUploadRoutes);

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
