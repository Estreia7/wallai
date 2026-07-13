const path = require('path');
const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'wallai',
      cwd: root,
      script: path.join(root, 'node_modules/next/dist/bin/next'),
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3003',
      },
    },
  ],
};
