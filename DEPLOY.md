- The app is split into four services: web, mail, worker, rtdb.
- Each service runs independently and shares the same codebase and Dockerfile.
- MongoDB is used for the database. Set `MONGODB_URI` in Railway environment variables.
- The `docker-compose.yml` can be used for local development or as a reference for Railway service setup.
- The `.env.example` file provides the required environment variables.

## Services
- **web**: Next.js frontend and API
- **mail**: Mail server to receive and process newsletters
- **worker**: Background worker to process background tasks
- **rtdb**: Real-time database service to emit change events


## Run Localy

To run all services locally using Docker Compose and environment variables from `.env`, and name the main container `BentoMail`, use:

```sh
npm run build
docker compose --env-file .env up -d
```

## How to deploy on Railway

1. Create a new project and add a MongoDB cluster.
2. For each service, create a new Railway service using the same repo and Dockerfile.
3. Set the required environment variables for each service. See [docker-compose.yml](./docker-compose.yml).
4. Set the correct start command for each service (as in docker-compose.yml):
   - web: `npx next start`
   - mail: `node scripts/start-mail-server.mjs`
   - worker: `node scripts/start-worker.mjs`
   - rtdb: `node scripts/start-rtdb.mjs`
