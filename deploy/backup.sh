#!/usr/bin/env bash
set -euo pipefail
DIR=/var/www/peace/backups
STAMP=$(date +%F)
mkdir -p "$DIR"

pg_dump -U peace -h localhost -Fc peace > "$DIR/db-$STAMP.dump"
find "$DIR" -name 'db-*.dump' -mtime +14 -delete

rclone copy "$DIR" gdrive:peace-backups/db
rclone sync /var/www/peace/uploads gdrive:peace-backups/uploads
