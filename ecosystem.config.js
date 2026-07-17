module.exports = {
  apps: [
    {
      name: 'gcm-tickets',
      // Backend (API + JWT). Requiere haber corrido "npm run build" antes de
      // "pm2 start" (compila server.ts/src/**/*.ts a dist/). Escucha en el
      // puerto de PORT en .env (default 3000).
      script: 'dist/server.js',
      cwd: 'C:\\Users\\Administrador\\SistemaApp\\backend',
      // fork (no cluster): con instances:1 PM2 usaría cluster por defecto, y ni
      // el backend ni Next.js estan pensados para el modo cluster de Node.
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'C:\\Users\\Administrador\\SistemaApp\\logs\\error.log',
      out_file: 'C:\\Users\\Administrador\\SistemaApp\\logs\\out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'gcm-tickets-web',
      // Frontend Next.js (web/). Requiere haber corrido "npm run build"
      // dentro de web/ antes de "pm2 start". Escucha en el puerto 3001
      // (debe coincidir con WEB_PORT en backend/.env). En Windows, PM2 no
      // puede lanzar "npm" (npm.cmd) directamente, así que ejecutamos el
      // binario de Next.js — equivale a "next start -p 3001".
      script: 'node_modules/next/dist/bin/next',
      // -H 0.0.0.0: escuchar en todas las interfaces IPv4, no solo IPv6 (::),
      // para que otros equipos de la red alcancen el frontend por la IP LAN.
      args: 'start -p 3001 -H 0.0.0.0',
      interpreter: 'node',
      cwd: 'C:\\Users\\Administrador\\SistemaApp\\web',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'C:\\Users\\Administrador\\SistemaApp\\logs\\web-error.log',
      out_file: 'C:\\Users\\Administrador\\SistemaApp\\logs\\web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
