module.exports = {
  apps: [
    {
      name: 'gcm-tickets',
      // Backend (API + JWT). Requiere haber corrido "npm run build" antes de
      // "pm2 start" (compila server.ts/src/**/*.ts a dist/). Escucha en el
      // puerto de PORT en .env (default 3000).
      script: 'dist/server.js',
      cwd: 'C:\\Users\\Administrador\\SistemaApp\\backend',
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
      // dentro de web/ antes de "pm2 start". Escucha en el puerto fijado en
      // web/package.json (next start -p 3001) — debe coincidir con WEB_PORT
      // configurado en backend/.env.
      script: 'npm',
      args: 'run start',
      cwd: 'C:\\Users\\Administrador\\SistemaApp\\web',
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
