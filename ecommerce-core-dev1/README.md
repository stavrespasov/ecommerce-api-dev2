# Handoff Doc

## Introduction
The Core Platform for E-commerce API (`ecommerce-core-dev1`) has been built successfully! It contains the master Prisma database schema, LLM AI abstractions, background bullmq workers, specific AI pipelines, and the exposed singleton `AIJobService`. 

## 1. Installation Command
To install and depend on this package locally in **Dev 2's API repo**, run:
```bash
npm install ../ecommerce-core-dev1
```
*(Make sure to adjust the relative path if the folders are structured differently)*

## 2. Import Path
In Dev 2's codebase, you can now seamlessly import the actual implementation of the AI Job Service replacing the stub:
```typescript
import { AIJobService } from 'ecommerce-core-dev1'

// You also have full access to schema enums and explicit types:
import { PipelineType, AIJob, JobStatus } from 'ecommerce-core-dev1'
```

## 3. Required Environment Variables
Ensure both Dev 1 and Dev 2 setups have the following `.env` defined properly:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
REDIS_URL="redis://127.0.0.1:6379"

# Provide at least one matching the provider you select
LLM_PROVIDER="openai" # or "anthropic"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-..."
```

## 4. Database Migrations & Initial Setup
**Master Prisma Schema is located in this (`ecommerce-core-dev1`) repo.** Dev 2 can extend the schema additively on their end.
To initialize the database shape, inside the core directory run:
```bash
# Push the schema structure into your running postgres instance
npx prisma db push

# Run the seed to establish the initial prompt templates and a test client
npx tsx prisma/seed.ts
```

## Additional Notes
- `vitest` unit/integration tests can be run via `npx vitest` and assert end-to-end functionality utilizing a fully-mocked LLM layer that validates expected schema outputs correctly.
- Background Jobs safely process sequentially up to your BullMQ worker concurrency and feature an exponential backoff specifically set at sizes relative to what was requested locally inside PG.
