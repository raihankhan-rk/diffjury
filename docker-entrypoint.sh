#!/bin/sh
set -eu

mkdir -p /data
chown -R nextjs:nodejs /data

exec su-exec nextjs:nodejs "$@"
