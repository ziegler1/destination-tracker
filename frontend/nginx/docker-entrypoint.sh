#!/bin/sh
set -e

# Substitute only $BACKEND_URL; leave all other nginx variables intact.
envsubst '$BACKEND_URL' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
