# TODO: AI Planning Agent PRD Execution

This file tracks the remaining work for the AI planning agent. The product goal is to reduce cognitive load by turning tasks, deadlines, calendar events, and daily stress/energy signals into a realistic plan.

Core rule: tasks, calendar events, scheduled blocks, check-ins, AI insights, AI actions, and uploaded inputs are the source of truth. Chat, image, and voice are input layers only.

## Current State

### Done

- [x] Prisma schema and initial Postgres migration.
- [x] Mock authenticated demo user in `lib/auth.ts`.
- [x] Seed data for demo user, preferences, planning cycle, tasks, calendar events, scheduled blocks, daily check-in, and AI insights.
- [x] Task APIs:
  - [x] `GET /api/tasks`
  - [x] `POST /api/tasks`
  - [x] `PATCH /api/tasks/[id]`
  - [x] `DELETE /api/tasks/[id]`
  - [x] `POST /api/tasks/[id]/complete`
  - [x] `POST /api/tasks/[id]/breakdown`
- [x] Calendar event APIs:
  - [x] `GET /api/calendar/events?start=&end=`
  - [x] `POST /api/calendar/events`
  - [x] `PATCH /api/calendar/events/[id]`
  - [x] `DELETE /api/calendar/events/[id]`
- [x] Schedule read and scheduled block APIs:
  - [x] `GET /api/schedule?start=&end=`
  - [x] `PATCH /api/scheduled-blocks/[id]`
  - [x] `POST /api/scheduled-blocks/[id]/complete`
  - [x] `POST /api/scheduled-blocks/[id]/skip`
- [x] Daily check-in APIs:
  - [x] `POST /api/checkins/daily`
  - [x] `GET /api/checkins?start=&end=`
  - [x] `POST /api/schedule/adjust-today`
- [x] Today dashboard API:
  - [x] `GET /api/dashboard/today?date=YYYY-MM-DD`
- [x] Chat and AI action pipeline:
  - [x] `POST /api/chat/message`
  - [x] `GET /api/chat/threads`
  - [x] `GET /api/chat/threads/[id]/messages`
  - [x] `POST /api/ai-actions/[id]/confirm`
  - [x] `POST /api/ai-actions/[id]/cancel`
- [x] Uploaded input APIs:
  - [x] `POST /api/uploads/image`
  - [x] `POST /api/uploads/voice`
- [x] Insight APIs:
  - [x] `GET /api/insights/current`
  - [x] `POST /api/insights/generate`
- [x] Advisory planning insights for daily/weekly planning, recovery windows, and schedule-regeneration recommendations.
- [x] Tasks page loads Prisma data and supports create, edit, and soft-delete.
- [x] Calendar page loads Prisma data and supports soft-delete for calendar events.
- [x] Chat can answer read-only weekday priority questions, such as "what is my highest priority task Monday", without creating schedule actions.
- [x] Basic API documentation in `docs/API.md`.
- [x] Validation tests in `tests/api-validation.test.ts`.
- [x] Basic frontend placeholder pages.

### Partial

- [ ] Voice/image pipeline exists, but API and frontend need final alignment around `imageData`, `audioData`, `mimeType`, transcripts, and proposed action cards.
- [ ] Gemini parser exists, but fallback and confidence behavior should be tightened for demo reliability.
- [x] Task difficulty exists as `cognitiveLoad`; backend/chat inference and task-page manual controls are started.
- [ ] Task breakdown exists, but is still deterministic/basic and not good enough for bigger tasks.
- [x] Schedule read/update APIs exist, and MVP schedule generation is implemented.
- [ ] Daily adjustment exists, but does not yet rewrite or propose concrete block changes.
- [x] API docs exist and include current task, calendar, schedule, dashboard, chat, upload, and insight contracts.

### Missing

- [ ] Real Google Calendar OAuth and sync.
- [x] `POST /api/schedule/generate`.
- [x] `GET /api/insights/current`.
- [x] `POST /api/insights/generate`.
- [ ] `GET /api/me`.
- [ ] `PATCH /api/me/preferences`.
- [ ] Planning cycle APIs.
- [ ] Frontend pages wired to real APIs.
- [x] AI action confirmation/edit cards in the frontend chat page.

## Priority 0: Demo-Critical Backend Completion

### Schedule Generation

- [x] Implement `POST /api/schedule/generate`.
- [x] Input can be minimal for MVP:
  - [x] optional `planningCycleId`
  - [x] optional `start`
  - [x] optional `end`
  - [x] optional `dryRun`
- [x] Use current user tasks, calendar events, preferences, scheduled blocks, and latest daily check-in.
- [x] Select incomplete tasks with:
  - [x] `status` in `todo`, `scheduled`, `in_progress`, `deferred`
  - [x] `estimatedMinutes` present or defaultable
  - [x] due date urgency and priority
- [x] Create proposed `ScheduledBlock` rows.
- [x] Do not overlap:
  - [x] non-cancelled calendar events
  - [x] accepted/proposed scheduled blocks
- [x] Respect user preferences:
  - [x] `workStartTime`
  - [x] `workEndTime`
  - [x] `preferredBlockLengthMinutes`
  - [x] `minimumBreakMinutes`
  - [x] `maxTotalWorkMinutesPerDay`
  - [x] `maxHardWorkMinutesPerDay`
- [x] Prefer scheduling before `dueAt`.
- [x] Attach blocks to tasks.
- [x] Add `schedulingReason`.
- [x] Return created/proposed blocks and any unscheduled task reasons.
- [ ] Add tests for due-date priority ordering.

### Task Difficulty

- [x] Keep `cognitiveLoad` as the canonical difficulty field, range `1-7`.
- [x] Add frontend labels:
  - [x] `1-2`: light
  - [x] `3-4`: moderate
  - [x] `5`: hard
  - [x] `6-7`: deep work
- [x] Add UI controls for difficulty on task creation/edit.
- [ ] Add sensible defaults by `workType`:
  - [ ] `study`: 5
  - [ ] `writing`: 5
  - [ ] `project`: 6
  - [ ] `admin`: 2
  - [ ] `reading`: 4
  - [ ] `creative`: 5
  - [ ] `personal`: 3
- [x] Update chat/mock parser path to infer difficulty from language:
  - [x] "easy", "quick", "simple" -> lower load
  - [x] "hard", "deep work", "project", "midterm", "essay" -> higher load
- [ ] Tighten Gemini parser schema/prompt so model output consistently includes difficulty and estimated minutes.
- [ ] Show cognitive load on dashboard top tasks and schedule blocks.
- [x] Show cognitive load on task cards.

### Bigger Task Breakdown

- [ ] Improve `POST /api/tasks/[id]/breakdown`.
- [ ] If `estimatedMinutes <= preferredBlockLengthMinutes`, return one step or explain no breakdown needed.
- [ ] If `estimatedMinutes` is large, split by preferred block length.
- [ ] Generate breakdowns using `workType`:
  - [ ] study: review, practice, self-test, summarize
  - [ ] writing: outline, draft, revise, proofread
  - [ ] project: scope, implement, test, polish
  - [ ] admin: gather info, complete form/task, submit/check
- [ ] Preserve existing breakdowns unless user requests replacement.
- [ ] Add optional body:
  - [ ] `replaceExisting?: boolean`
  - [ ] `targetBlockMinutes?: number`
- [ ] Return:
  - [ ] task
  - [ ] breakdowns
  - [ ] replacedExisting
- [ ] Add tests for large writing/study/project tasks.

### Daily Adjustment

- [ ] Improve `POST /api/schedule/adjust-today`.
- [ ] Use latest daily check-in when available.
- [ ] If `energyScore <= 2` or `stressScore >= 6`, prefer:
  - [ ] shorter blocks
  - [ ] lower cognitive load
  - [ ] urgent tasks only
  - [ ] preserve fixed calendar events
- [ ] Return concrete proposed adjustments:
  - [ ] keep
  - [ ] shorten
  - [ ] move
  - [ ] skip
  - [ ] replace with lower-load task
- [ ] Do not mutate accepted blocks without confirmation.
- [ ] Create `AiInsight` explaining the adjustment.

## Priority 1: Real Google Calendar Connection

### OAuth Setup

- [ ] Add Google OAuth configuration.
- [ ] Required env vars:
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `GOOGLE_REDIRECT_URI`
  - [ ] `GOOGLE_CALENDAR_SCOPES`
- [ ] Use calendar readonly scope first:
  - [ ] `https://www.googleapis.com/auth/calendar.readonly`
- [ ] Add routes:
  - [ ] `GET /api/calendar/google/connect`
  - [ ] `GET /api/calendar/google/callback`
  - [ ] `POST /api/calendar/google/sync`
- [ ] Store provider connection data securely.
- [ ] Do not expose tokens to frontend.

### Data Model Decision

- [ ] Decide whether to add a dedicated `CalendarConnection` table.
- [ ] Recommended schema:
  - [ ] `id`
  - [ ] `userId`
  - [ ] `provider`
  - [ ] `accessTokenEncrypted`
  - [ ] `refreshTokenEncrypted`
  - [ ] `expiresAt`
  - [ ] `calendarId`
  - [ ] `createdAt`
  - [ ] `updatedAt`
- [ ] If avoiding token storage for hackathon, support a short-lived demo sync only and document limitation.

### Sync Behavior

- [ ] Import Google events into `CalendarEvent`.
- [ ] Set:
  - [ ] `provider = "google"`
  - [ ] `externalEventId`
  - [ ] `calendarId`
  - [ ] `rawProviderData`
  - [ ] `source = "google_import"`
  - [ ] `status`
- [ ] Upsert using unique key `[userId, provider, externalEventId]`.
- [ ] Handle all-day events.
- [ ] Handle cancelled Google events by setting `status = "cancelled"`.
- [ ] Add sync range:
  - [ ] default: today through 30 days from now
  - [ ] optional `start` and `end`
- [ ] Acceptance:
  - [ ] User can connect Google Calendar.
  - [ ] Imported events appear in calendar/dashboard/schedule APIs.
  - [ ] Scheduler treats imported events as fixed busy blocks.

## Priority 2: Voice And Image Setup Now

### API Contract Alignment

- [ ] Update upload endpoints to accept both current frontend payloads and MVP JSON fallback:
  - [ ] `fileUrl`
  - [ ] `rawTextExtracted`
  - [ ] `imageData`
  - [ ] `audioData`
  - [ ] `mimeType`
- [ ] Keep no-production-storage behavior for now.
- [ ] Store raw base64 only if needed for parser call; avoid storing huge blobs in Postgres long-term.
- [ ] Return consistent shape:
  - [ ] `uploadedInput`
  - [ ] `transcript` for voice
  - [ ] `parsedItems`
  - [ ] `proposedActions`

### Image Parsing

- [ ] Wire image endpoint to `parseGeminiMultimodal(..., "image")`.
- [ ] Fallback to mock image event if Gemini fails.
- [ ] Create `UploadedInput` row before parsing.
- [ ] Store parsed payload.
- [ ] Create proposed `AiAction` rows.
- [ ] Require confirmation for image-extracted actions.
- [ ] Add confidence language in response.

### Voice Parsing

- [ ] Wire voice endpoint to `parseGeminiVoice`.
- [ ] Store transcript in `rawTextExtracted`.
- [ ] Pass transcript through same action parser as chat.
- [ ] Do not implement live voice agent.
- [ ] Proposed voice actions should require confirmation unless clearly safe and high confidence.

### Frontend

- [ ] Chat page image upload should call `/api/uploads/image`.
- [ ] Chat page voice recording should call `/api/uploads/voice`.
- [ ] Show transcript for voice.
- [ ] Show parsed action cards.
- [ ] Add confirm/cancel buttons for proposed actions.

## Priority 3: Frontend Demo Flow

### Dashboard Page

- [ ] Wire dashboard page to `GET /api/dashboard/today`.
- [ ] Show:
  - [ ] daily check-in
  - [ ] today scheduled blocks
  - [ ] top tasks
  - [ ] next calendar event
  - [ ] AI insights
- [ ] Add check-in form.
- [ ] Show lighter-plan insight when stress is high or energy is low.

### Tasks Page

- [x] Wire task list to seeded task data.
- [x] Add task creation form.
- [x] Add edit actions.
- [x] Add soft-delete/cancel action.
- [ ] Add complete action.
- [x] Add cognitive load control.
- [x] Add estimated minutes field.
- [ ] Add task breakdown button.
- [x] Show breakdown rows under parent task.

### Calendar / Planner Page

- [x] Wire to seeded schedule data.
- [x] Show calendar events and scheduled blocks together.
- [x] Add delete control for calendar events.
- [ ] Add generate schedule button.
- [ ] Add complete/skip/move controls for blocks.
- [x] Show block status and scheduling reason.

### Chat Page

- [ ] Load thread messages from API.
- [ ] Send chat messages to `/api/chat/message`.
- [x] Show AiAction cards.
- [x] Add confirm/cancel buttons.
- [x] Add edit payload before confirm.
- [x] Answer read-only task priority questions using DB data without creating AiAction rows.
- [ ] Support image and voice upload flow.

### Upload Confirmation

- [ ] Show parsed image/voice items.
- [ ] Let user confirm or cancel proposed actions.
- [ ] Confirmed actions should create/update source-of-truth rows.

## Priority 4: Insights And Metrics

### Insight APIs

- [x] Implement `GET /api/insights/current`.
- [x] Implement `POST /api/insights/generate`.
- [x] Generate daily tactical insight from:
  - [x] check-in
  - [x] today blocks
  - [x] urgent tasks
  - [x] calendar events
  - [x] skipped/incomplete blocks
- [x] Generate weekly/recovery insight from:
  - [x] total scheduled work minutes
  - [x] high-load blocks
  - [x] upcoming deadlines
  - [x] stress/energy check-ins
  - [x] free weekend windows

### Recovery Window

- [x] Calculate free windows from calendar events and scheduled blocks.
- [x] Prefer weekend or evening openings.
- [x] Create `AiInsight` with `insightType = "recovery_window"`.
- [x] Phrase as suggestion, not medical advice.

### Metrics

- [ ] Track or query:
  - [ ] daily check-in completion
  - [ ] task completion rate
  - [ ] scheduled block completion/skips
  - [ ] AI actions proposed/confirmed/executed
  - [ ] stress/energy vs scheduled block completion

## API Backlog From PRD

- [ ] `GET /api/me`
- [ ] `PATCH /api/me/preferences`
- [ ] `GET /api/planning-cycles/current`
- [ ] `POST /api/planning-cycles`
- [ ] `PATCH /api/planning-cycles/[id]/intake`
- [x] `POST /api/schedule/generate`
- [x] `GET /api/insights/current`
- [x] `POST /api/insights/generate`
- [ ] `GET /api/calendar/google/connect`
- [ ] `GET /api/calendar/google/callback`
- [ ] `POST /api/calendar/google/sync`

## Demo Script Readiness

- [ ] Open Today dashboard with seeded data.
- [ ] Show existing events and daily check-in.
- [ ] Add task through chat:
  - [ ] "Add a chem midterm study task for Thursday, high priority, 3 hours."
- [ ] Show task appears in task list.
- [ ] Generate schedule.
- [ ] Show proposed study blocks around calendar events.
- [ ] Submit daily check-in:
  - [ ] energy `2`
  - [ ] stress `6`
- [ ] Show lighter-plan insight.
- [ ] Generate weekly/planning insight from `/api/insights/generate`.
- [ ] Upload event flyer image.
- [ ] Confirm parsed event.
- [ ] Show calendar updates and scheduler avoids that time.
- [ ] Show recovery insight.

## Testing Checklist

- [ ] Keep passing:
  - [ ] `npm run test`
  - [ ] `npm run lint`
  - [ ] `npm run typecheck`
- [ ] Add tests for:
  - [x] schedule generation conflict avoidance
  - [x] insight endpoint validation
  - [x] chat next-weekday priority query behavior
  - [ ] task difficulty validation/defaults
  - [ ] task breakdown generation for large tasks
  - [ ] Google Calendar event upsert
  - [ ] upload payload compatibility
  - [ ] Gemini parser fallback behavior
  - [ ] AiAction confirmation creates real rows
  - [ ] dashboard data shape with seeded records
- [ ] Add one demo smoke script:
  - [ ] seed database
  - [ ] create chat task
  - [ ] generate schedule
  - [ ] submit check-in
  - [ ] parse upload
  - [ ] confirm action

## Product Guardrails

- [ ] Do not describe the app as diagnosing burnout.
- [ ] Use language like "workload may indicate overload."
- [ ] Keep check-in fields to energy, stress, capacity, and note.
- [ ] Do not add mood or sleep fields.
- [ ] Do not silently delete user data.
- [ ] Confirm risky AI actions.
- [ ] Keep DB tables as source of truth.
- [ ] Keep chat/image/voice as input layers only.

## Recommended Next Build Order

1. [ ] Wire dashboard page to APIs.
2. [ ] Add generate schedule controls to the Calendar / Planner page.
3. [ ] Add complete controls for task cards and scheduled blocks.
4. [ ] Load existing chat thread history from APIs.
5. [ ] Align upload endpoints with current frontend `imageData/audioData/mimeType` payloads.
6. [ ] Finish voice/image Gemini flow and confirmation cards.
7. [ ] Improve task breakdowns for large tasks.
8. [ ] Add real Google Calendar OAuth/import.
9. [ ] Add metrics queries for check-in, completion, and AI action success.
