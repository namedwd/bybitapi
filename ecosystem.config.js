module.exports = {
  apps: [{
    name: 'bybit-api-server',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    min_uptime: '10s',
    max_restarts: 10,
    kill_timeout: 5000,
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // CPU 제한
    max_cpu_restart: '90%',
    // 메모리 누수 방지
    cron_restart: '0 */6 * * *' // 6시간마다 재시작
  }]
};
