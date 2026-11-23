#!/bin/sh
set -eu
for archivo in index.html boundary/app.js config/api.js sw.js manifest.webmanifest; do
    test -r "/var/www/html/$archivo" || { echo "Monte src en /var/www/html: falta $archivo" >&2; exit 1; }
done
nginx -t
exec nginx -g 'daemon off;'
