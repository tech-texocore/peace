#!/usr/bin/env bash
# Only when the domain is proxied through Cloudflare: lets Nginx (and the API's
# rate limit / audit log) see each visitor's real IP instead of Cloudflare's.
# Re-run occasionally to pick up changes to Cloudflare's IP list.
set -euo pipefail
OUT=/etc/nginx/conf.d/cloudflare-real-ip.conf
{
  for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done
  echo "real_ip_header CF-Connecting-IP;"
} | sudo tee "$OUT" >/dev/null
sudo nginx -t && sudo systemctl reload nginx
echo "Cloudflare real IP configured ($OUT)"
