# Docker Setup

This project is fully dockerized for easy deployment and sharing.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start (Production)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd delivery_backend
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Build and start**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the API**
   - API: http://localhost:3000

## Commands

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build the Docker images |
| `npm run docker:up` | Start containers in background |
| `npm run docker:down` | Stop and remove containers |
| `npm run docker:logs` | View API logs (follow mode) |
| `npm run docker:dev` | Start development environment |
| `npm run docker:dev:build` | Rebuild and start dev environment |

## Development Mode

Development mode mounts your source code and enables hot reloading:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Environment Variables

Configure via `.env` file or pass directly to docker-compose:

### Required
| Variable | Description | Default |
|----------|-------------|---------|
| `PG_USER` | PostgreSQL username | `postgres` |
| `PG_PASSWORD` | PostgreSQL password | `postgres` |
| `PG_DB` | Database name | `delivery_db` |
| `JWT_SECRET` | JWT signing secret | (change this!) |

### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `SMTP_HOST` | Email SMTP host | - |
| `SMTP_USER` | Email username | - |
| `SMTP_PASSWORD` | Email password | - |
| `SMS_API_KEY` | SMS service API key | - |

## Data Persistence

PostgreSQL data is stored in a Docker volume (`postgres_data`). To reset:

```bash
docker-compose down -v  # -v removes volumes
docker-compose up -d --build
```

## Troubleshooting

### View logs
```bash
docker-compose logs api
docker-compose logs db
```

### Enter container shell
```bash
docker exec -it delivery_api sh
docker exec -it delivery_db psql -U postgres -d delivery_db
```

### Rebuild from scratch
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```
