#!/bin/sh
set -e

# Substitute only $BACKEND_URL in nginx config
envsubst '$BACKEND_URL' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

# Inject Google Maps API key into index.html at runtime
if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
  sed -i "s|GOOGLE_MAPS_API_KEY_PLACEHOLDER|${GOOGLE_MAPS_API_KEY}|g" \
    /usr/share/nginx/html/index.html
fi

exec nginx -g 'daemon off;'
