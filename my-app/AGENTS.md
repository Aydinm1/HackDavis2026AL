<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Project Overview

This is a hackathon MVP for an AI planning app that helps users reduce cognitive stress by organizing tasks, calendar events, daily energy/stress check-ins, AI-generated schedule blocks, and insights.

The core product is NOT a generic chatbot. Chat, image, and voice are input methods that produce structured AI actions. The database remains the source of truth.

## Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- API routes under `app/api`
- Shared backend logic under `lib`
- Prisma schema under `prisma/schema.prisma`

## Development Rules

- Use TypeScript.
- Prefer small, readable service functions over large route handlers.
- Do not call external AI APIs directly from frontend components.
- Frontend should call backend API routes only.
- Validate request bodies in API routes.
- Keep all user-scoped queries filtered by `userId`.
- For MVP, use a temporary mocked authenticated user helper if auth is not implemented.
- Do not implement real Google Calendar OAuth unless explicitly requested.
- Calendar events can be manual/mock for MVP.
- Do not build a live voice agent.
- Voice input should be treated as transcription → text command → AI action parser.
- Image input should be treated as image upload → parsed structured payload → confirmation/action.

## Product Rules

- Tasks are things the user needs to do.
- Calendar events are fixed busy blocks.
- Scheduled blocks are proposed or accepted work sessions for tasks.
- Daily check-ins track:
  - energyScore: 1–7
  - stressScore: 1–7
- AI actions must be validated before modifying core tables.
- Risky/destructive AI actions should require confirmation.

## Required Commands

After meaningful code changes, run:

```bash
npm run lint
npm run typecheck

```
Folder Stucture:

app/
  api/
  dashboard/
  tasks/
  calendar/
  chat/

lib/
  db.ts
  auth.ts
  services/
    tasks.ts
    calendarEvents.ts
    scheduling.ts
    checkins.ts
    insights.ts
    chatActions.ts
  ai/
    actionSchemas.ts
    mockParser.ts
  scheduling/
    findFreeWindows.ts
    scoreSlots.ts

prisma/
  schema.prisma

  