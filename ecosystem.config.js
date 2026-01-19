module.exports = {
  apps: [
    {
      name: 'ppt-creator',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_file: './logs/combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 日志轮转（需要安装 pm2-logrotate）
      // pm2 install pm2-logrotate
      // pm2 set pm2-logrotate:max_size 10M
      // pm2 set pm2-logrotate:retain 7
    },
  ],
}
