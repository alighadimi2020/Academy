#!/bin/sh
set -e

echo "=== Academy Docker Entrypoint ==="

# Wait for PostgreSQL database
echo "Checking database connectivity..."
python -c '
import os, time, sys, psycopg

host = os.getenv("DB_HOST", "127.0.0.1")
port = int(os.getenv("DB_PORT", "5432"))
user = os.getenv("DB_USER", "postgres")
password = os.getenv("DB_PASSWORD", "")
dbname = os.getenv("DB_NAME", "postgres")

max_attempts = 30
for i in range(1, max_attempts + 1):
    try:
        conn = psycopg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            connect_timeout=3
        )
        conn.close()
        print(f"[OK] Successfully connected to PostgreSQL at {host}:{port}/{dbname}")
        sys.exit(0)
    except Exception as exc:
        print(f"[{i}/{max_attempts}] Waiting for PostgreSQL ({host}:{port}/{dbname})... {exc}")
        time.sleep(2)

print("[ERROR] Could not connect to PostgreSQL within timeout period.")
sys.exit(1)
'

# Only run migrations & collectstatic once from web container, not from bot worker
if [ "$1" = "gunicorn" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput

    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

echo "Starting command: $@"
exec "$@"
