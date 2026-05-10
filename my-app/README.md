# Flow State

## Watch the Demo First

**Start here: [DEMO.MOV](./DEMO.MOV)**  
The demo video is intentionally linked at the top because it shows the core flow faster than screenshots: chat/image input, AI action previews, schedule generation, calendar edits, energy check-ins, and insights.

## What It Is

Flow State is a hackathon MVP for an AI planning app that turns messy student planning inputs into structured tasks, calendar events, schedule blocks, check-ins, and insights.

The product is not a generic chatbot. Chat, image, and voice are input methods for creating validated actions. The database remains the source of truth, and risky or destructive changes require confirmation before they modify core records.

## Core Features

- Chat-based planning that parses natural language into tasks, events, check-ins, schedule proposals, and updates.
- Image upload parsing for event details, with confirmation before saving.
- Task creation, breakdowns, editing, deletion, completion, and calendar-linked scheduled blocks.
- Calendar view for fixed events and generated study/work blocks, including edit/delete controls.
- AI schedule previews that respect tasks, fixed events, preferences, check-ins, and open time.
- Daily onboarding check-in for energy and stress.
- Statistics page with daily energy visuals, past energy calendar, weekly insights, task/event graphs, and average stress/energy bars.
- Google Calendar service layer for OAuth/calendar sync support.

## Tech Stack

- Next.js App Router
- TypeScript
- React
- Prisma
- PostgreSQL
- Tailwind CSS
- Framer Motion
- Gemini / Vertex AI parsing with fallback parser logic
- Backboard integration support
- Git LFS for demo video storage

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env
```

Fill in at least:

```bash
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."
```

Optional AI/calendar integrations are documented in `.env.example`.

Generate Prisma client and seed demo data:

```bash
npm run prisma:generate
npm run seed
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run prisma:migrate
npm run seed
```

## Project Structure

```text
app/
  api/                 API routes
  calendar/            Calendar UI
  chat/                Chat/action UI
  statistics/          Energy and weekly insights UI
  todolist/            Task UI
  _components/         Shared app components

lib/
  ai/                  Gemini, Backboard, and fallback parsers
  services/            Task, calendar, schedule, check-in, insight, chat services
  auth.ts              MVP user helper
  db.ts                Prisma client

prisma/
  schema.prisma        Data model
  seed.ts              Demo seed data

tests/
  api-validation.test.ts
```

## Product Model

- Tasks are things the user needs to do.
- Calendar events are fixed busy blocks.
- Scheduled blocks are proposed or accepted work sessions for tasks.
- Daily check-ins track energy and stress from 1 to 7.
- AI actions are validated before modifying database-backed records.
- Confirmations are required for risky actions such as scheduling, event changes, and destructive updates.
