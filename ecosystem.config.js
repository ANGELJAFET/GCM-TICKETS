module.exports = {
  apps: [
    {
      name: 'gcm-tickets',
      script: 'server.js',
      cwd: 'C:\\Users\\Administrador\\SistemaApp',
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
  ],
};
