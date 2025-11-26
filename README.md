# Bento App

**Bento cuts through newsletter overload.** Just forward your newsletters to the app, and it automatically ingests, organizes, and distills everything into clean, bite-sized insights. Powered by automation and AI, it gives you only the key updates –beautifully presented and delivered on your schedule— so you stay informed without the overwhelm.

## Overview

### How it works

1. [Deploy](#deployment) the application and mail server.
2. [Set up email filters](./docs/setup-mail-client.md) in your email client to forward all your newsletters to the mail server.
3. Bento will extract all articles, crawl them, and summarize them in a concise, relevant, and read-friendly format.
4. Go to the web interface at your own pace and browse through your summarized bits. Click on an item to see more details (3 more lines), or click on _Read Full Article_ if you prefer to see the original source.
5. Clear your list as you read through by using the bottom toolbar (❤️ _Relevant_, ❌ _Not Relevant_, 🚩 _Flag Error_, 🔄 _Re-process_).

### Before Bento

![article](./docs/images/original%20article.png)

### After Bento

![Summarized by Bento](./docs/images/bento%20ui.png)

# Getting Started

**Note:** This project is a work-in-progress and not production-ready.

## Set Up

### Prerequisites

- Node.js 22+
- MongoDB (local or cloud)
- OpenAI API key with access to GPT-5-mini
- [Optional] Account on [ForwardEmail.net](https://forwardemail.net/) (required if deploying to a cloud server)
- [Optional] Docker (for containerized setup)

### Development

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd bento-mail
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy the content of [.env.example](./.env.example) to a new file `.env` and set the required environment variables.
4. Build and start development server and services:
   ```sh
   npm start
   ```

### Testing

- Run all unit tests:
  ```sh
  npm test
  ```
- **Testing LLM prompts (ignored in unit tests)**. The [AI Analyzer](./src/lib/ai-article-analyzer.ts) module is responsible for analyzing, classifying, and processing newsletter content. To tests the result of the prompts you need to provide `OPENAI_API_KEY` in the [.env](./.env.example) file and run:
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

## Operation

1. Send an email containing a newsletter or a link to an article to the app's server:
   1. If you're running the app locally you have two options for this:
      1. You can get started by forward emails programmatically with this [script](./scripts/fwd-email.mjs).
      2. Or you can [configure your local mail app](./docs/setup-mail-client.md#When-Bento-is-running-locally).
   2. If you've deployed the app to a cloud server: 
      1. You'll need an email server that supports webhooks. [See this guide](./docs/setup-mail-client.md#setup-mail-forwarding-service).
      2. 
2. After a couple of minutes\*, you can access your processed content via the web interface. If you're running it locally, it should be something like `http://localhost:3000?user=<your@email.address>`\*\*.

\* _Processing of email messages takes a few minutes, depending on the amount of articles found in the content._

\*\* _For now, the user email is passed via URL query parameters._

## Deployment

### Deploy using Docker

Start all services with Docker Compose (the project will be built during image build time):

```sh
docker compose --env-file .env up -d
```

### Deploy to [Railway](https://railway.com/)

Railway is a container-first cloud environment that allows to easily and visually deploy multi-container applications.

1. Create a new [Railway](https://railway.com/) project.
2. For each service, create a Railway service using the same repo and Dockerfile. It is recommended to use Railway's [drag-and-drop](https://railway.com/changelog/2024-04-19-drag-and-drop-docker) feature with the [docker-compose.yml](./docker-compose.yml) file.
3. Set the required environment variables for each service (see [docker-compose.yml](./docker-compose.yml)).
4. Set the correct start command for each service:
   - web: `npx next start`
   - mail: `node scripts/start-mail-server.mjs`
   - worker: `node scripts/start-worker.mjs`
   - rtdb: `node scripts/start-rtdb.mjs`
