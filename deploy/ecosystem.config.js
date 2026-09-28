const root = '/var/www/peace/app';

module.exports = {
  apps: [
    {
      name: 'peace-api',
      cwd: `${root}/peace-backend`,
      script: 'dist/main.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1G',
    },
    {
      name: 'peace-web',
      cwd: `${root}/peace-web`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '1G',
    },
  ],
};
