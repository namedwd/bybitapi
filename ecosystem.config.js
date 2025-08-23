module.exports = {
  apps: [{
    name: 'bybit-mock-server',
    script: './server-new.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      WS_PORT: 8080,
      HTTP_PORT: 8081
    },
    env_production: {
      NODE_ENV: 'production',
      WS_PORT: 8080,
      HTTP_PORT: 8081
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
