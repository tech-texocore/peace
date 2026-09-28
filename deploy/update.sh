#!/usr/bin/env bash
# Load Node (nvm) first — nvm is not safe under set -u
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
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
