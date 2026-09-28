#!/usr/bin/env bash
set -euo pipefail
cd /var/www/peace/app
git pull

cd peace-backend
npm ci
NODE_ENV=production npx prisma migrate deploy
npx prisma generate
npm run build

cd ../peace-web
npm ci
npm run build

pm2 startOrReload /var/www/peace/app/deploy/ecosystem.config.js
