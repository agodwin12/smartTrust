#!/bin/sh
set -e

# Runs once per container start. Safe for a single instance or a small fixed number
# of replicas starting together — `prisma migrate deploy` tracks applied migrations
# in the database itself, so a late/concurrent starter just sees "nothing to do".
# For a larger fleet of replicas, prefer running this as a one-off release step
# instead of baking it into every replica's startup.
echo "Running database migrations..."
npx prisma migrate deploy

exec "$@"
