# Bento Mail

**Bento Mail cuts through newsletter overload.** Just forward your newsletters to the app, and it automatically ingests, organizes, and distills everything into clean, bite-sized insights. Powered by automation and AI, it gives you only the key updates –beautifully presented and delivered on your schedule— so you stay informed without the overwhelm.

## Sample Content

### Original article

![article](./docs/images/original%20article.png)

### Summarized by Bento Mail

![Summarized by Bento Mail](./docs/images/bento%20ui.png)

# Getting Started

**Note:** This project is a work-in-progress and not production-ready.

## Set Up

### Prerequisites

- Node.js 22+
- MongoDB (local or cloud)
- OpenAI API key
- [Optional] An account on [forwardemail.net](https://forwardemail.net/) (to receive emails and call the app's API).
- [Optional] Docker (for containerized setup)

### Local Development

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd bento-mail
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy `.env.example` to `.env` and set required environment variables.
4. Build and start development server and services:
   ```sh
   npm start
   ```

### Testing

- Run all unit tests:
  ```sh
  npm test
  ```
- Testing LLM prompts (ignored in unit tests). The [AI Analyzer](./src/lib/ai-article-analyzer.ts) module is responsible for analyzing, classifying, and processing newsletter content. To tests the result of the prompts you need to provide `OPENAI_API_KEY` in the [.env](./.env.example) file and run:
  ```sh
  npx vitest tests/ai-article-analyzer
  ```

### Environment Variables

- See [.env.example](./.env.example) and [docker-compose.yml](./docker-compose.yml) for required variables.

### Project Structure

- `src/app/` — Next.js frontend, API routes, hooks, and views
- `src/lib/` — Core models, utilities, and AI analyzers
- `src/services/` — Worker, RTDB, email, and related services
- `scripts/` — Utility scripts for mail server, RTDB, and email forwarding
- `tests/` — Vitest unit and integration tests

### Services

- **web**: Next.js frontend and API
- **mail**: Mail server to receive and process newsletters
- **worker**: Background worker to process background tasks
- **rtdb**: Real-time database service to emit change events

## Deployment

### Docker

Start all services with Docker Compose (the project will be built during image build time):

```sh
docker compose --env-file .env up -d
```

### Railway

1. Create a new [Railway](https://railway.com/) project.
2. For each service, create a Railway service using the same repo and Dockerfile. You can use Railway's [drag-and-drop](https://railway.com/changelog/2024-04-19-drag-and-drop-docker) feature.
3. Set required environment variables for each service (see `docker-compose.yml`).
4. Set the correct start command for each service:
   - web: `npx next start`
   - mail: `node scripts/start-mail-server.mjs`
   - worker: `node scripts/start-worker.mjs`
   - rtdb: `node scripts/start-rtdb.mjs`

# Operation
1. Configure your email client to forward your newsletters to the application. See [this guide](./docs/setup-mail-client.md).
2. Visit the application web interface under `http://localhost?user=<your email address>`.

Processing of email messages takes a few minutes, depending on the amount of articles found in the content.