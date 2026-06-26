require('dotenv').config();
const express = require('express');
const fs      = require('fs');

const db                = require('./src/db');
const { PUBLIC, UPLOADS, PORT } = require('./src/config');
const { getLocalIP }    = require('./src/helpers');

const authRoutes         = require('./src/routes/auth');
const ticketRoutes       = require('./src/routes/tickets');
const usuarioRoutes      = require('./src/routes/usuarios');
const inventoryRoutes    = require('./src/routes/inventory');
const mobileUploadRoutes = require('./src/routes/mobileUpload');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-store');
    }
  }
}));
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

app.get('/api/departamentos', async (req, res) => {
  try {
    res.json(await db.exec('sp_GetDepartamentos'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar departamentos' });
  }
});

db.initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n========================================');
    console.log('   GCM TICKETS - SERVIDOR ACTIVO');
    console.log('========================================');
    console.log('');
    console.log('  Acceso local (este equipo):');
    console.log(`    http://localhost:${PORT}/admin.html`);
    console.log(`    http://localhost:${PORT}/usuario.html`);
    if (localIP !== 'localhost') {
      console.log('');
      console.log('  Acceso desde otros equipos en la red:');
      console.log(`    http://${localIP}:${PORT}/admin.html   <- Soporte técnico`);
      console.log(`    http://${localIP}:${PORT}/usuario.html <- Empleados`);
    }
    console.log('');
    console.log('  Para detener el servidor: Ctrl + C');
    console.log('========================================\n');
  });
}).catch(err => {
  console.error('Error fatal al iniciar:', err);
  process.exit(1);
});
