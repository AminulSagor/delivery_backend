#!/bin/sh

echo "=== Starting Deployment ==="
echo "DATABASE_URL: ${DATABASE_URL:+SET}"

# Wait for network to be ready
sleep 3

# Run migrations (but don't fail if they error)
echo "Running database migrations..."
npm run typeorm:migrate:prod || echo "WARNING: Migrations failed, continuing anyway..."

echo "Starting application..."
exec npm run start:prod
