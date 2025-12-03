#!/bin/sh
set -e

echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."
npm run typeorm:migrate:prod

echo "Migrations completed successfully!"
echo "Starting application..."
exec npm run start:prod
