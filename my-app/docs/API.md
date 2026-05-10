# API Reference

This app uses Next.js Route Handlers under `app/api`. All endpoints currently use MVP/demo auth from `lib/auth.ts`, so every request is treated as the stable demo user:

```ts
demo_user_hackdavis_2026
```

There is no real auth or Google OAuth yet. Every database query is scoped by `userId`.

Responses use:

```json
{ "data": {} }
```

or:

```json
{ "error": "Message here." }
```

Dates are ISO strings. PostgreSQL stores them as timestamps, so responses are usually UTC ISO strings.

## Tasks

### GET `/api/tasks`

Returns all tasks for the current demo user, including task breakdowns and scheduled blocks.

Example response:

```json
{
  "data": [
    {
      "id": "demo_task_chem_midterm",
      "userId": "demo_user_hackdavis_2026",
      "planningCycleId": "demo_cycle_2026_05_11",
      "title": "Study for chemistry midterm",
      "description": "Review equilibrium, thermodynamics, and practice problems from the last three lectures.",
      "type": "school",
      "workType": "study",
      "timeframe": "weekly",
      "status": "todo",
      "dueAt": "2026-05-14T22:30:00.000Z",
      "priority": 1,
      "cognitiveLoad": 7,
      "estimatedMinutes": 240,
      "actualMinutes": null,
      "canSplit": true,
      "createdBy": "user",
      "taskBreakdowns": [],
      "scheduledBlocks": []
    }
  ]
}
```

### POST `/api/tasks`

Creates a task for the current demo user.

Accepted body:

```json
{
  "planningCycleId": "demo_cycle_2026_05_11",
  "title": "Study for chemistry midterm",
  "description": "Review practice problems",
  "type": "school",
  "workType": "study",
  "timeframe": "weekly",
  "dueAt": "2026-05-14T15:30:00-07:00",
  "priority": 1,
  "cognitiveLoad": 7,
  "estimatedMinutes": 90,
  "canSplit": true,
  "createdBy": "user"
}
```

Validation:

- `title` is required.
- `priority` must be an integer from `1` to `5`.
- `cognitiveLoad` must be an integer from `1` to `7`.
- `dueAt` must be an ISO date string or `null`.
- Unknown fields are rejected.
- If `planningCycleId` is provided, it must belong to the current user.

Response: `201` with the created task in `{ "data": task }`.

### PATCH `/api/tasks/[id]`

Updates a user-owned task.

Accepted body fields:

```json
{
  "planningCycleId": "demo_cycle_2026_05_11",
  "title": "Updated title",
  "description": "Updated notes",
  "type": "school",
  "workType": "writing",
  "timeframe": "weekly",
  "dueAt": "2026-05-16T23:59:00-07:00",
  "priority": 2,
  "cognitiveLoad": 6,
  "estimatedMinutes": 120,
  "canSplit": true,
  "createdBy": "user",
  "status": "in_progress",
  "actualMinutes": 45
}
```

Only include fields you want to update. Empty patch bodies are rejected.

Response: `200` with the updated task.

### DELETE `/api/tasks/[id]`

Soft-deletes a user-owned task by setting:

```json
{ "status": "cancelled" }
```

Response: `200` with the updated task.

### POST `/api/tasks/[id]/complete`

Marks a user-owned task complete.

Optional body:

```json
{
  "actualMinutes": 50
}
```

Behavior:

- Sets `status` to `"completed"`.
- Sets `actualMinutes` if provided.

Response: `200` with the updated task.

### POST `/api/tasks/[id]/breakdown`

Creates deterministic MVP task breakdowns without calling AI.

Optional body:

```json
{
  "replaceExisting": false,
  "targetBlockMinutes": 45
}
```

Behavior:

- Small tasks at or under `targetBlockMinutes` return one focused step.
- Large tasks split into blocks based on `targetBlockMinutes` or the user's preferred block length.
- Study, writing, project, admin, reading, creative, personal, and focus tasks use work-type-specific step templates.
- Existing breakdowns are preserved by default.
- Pass `replaceExisting: true` to delete and regenerate existing breakdowns.

Response: `201` with breakdown metadata.

```json
{
  "data": {
    "task": {
      "id": "demo_task_chem_midterm",
      "title": "Study for chemistry midterm",
      "workType": "study",
      "estimatedMinutes": 180,
      "cognitiveLoad": 7,
      "canSplit": true
    },
    "breakdowns": [
      {
        "id": "demo_task_chem_midterm_breakdown_1",
        "title": "Review core material",
        "description": "Planned as part 1 of 4 for Study for chemistry midterm.",
        "sequenceOrder": 1,
        "estimatedMinutes": 45,
        "cognitiveLoad": 7,
        "status": "todo",
        "createdBy": "ai"
      }
    ],
    "replacedExisting": false,
    "targetBlockMinutes": 45,
    "message": "Task was split into 4 steps based on a 45-minute target block."
  }
}
```

## Calendar Events

Calendar events are fixed busy blocks. For MVP, only manual/mock events are supported. Google OAuth is intentionally not implemented.

### GET `/api/calendar/events?start=&end=`

Returns calendar events for the current user that overlap the requested range.

Example:

```text
/api/calendar/events?start=2026-05-11T00:00:00-07:00&end=2026-05-18T00:00:00-07:00
```

Validation:

- `start` is required.
- `end` is required.
- Both must be valid ISO date strings.
- `end` must be after `start`.

Response:

```json
{
  "data": [
    {
      "id": "demo_event_chem_lecture",
      "provider": "mock",
      "title": "CHE 118 lecture",
      "location": "Sciences Lecture Hall 123",
      "startTime": "2026-05-11T16:00:00.000Z",
      "endTime": "2026-05-11T17:20:00.000Z",
      "isAllDay": false,
      "source": "manual",
      "status": "confirmed"
    }
  ]
}
```

### POST `/api/calendar/events`

Creates a manual calendar busy block.

Accepted body:

```json
{
  "title": "History discussion section",
  "description": "Weekly section",
  "location": "Voorhies Hall 204",
  "startTime": "2026-05-12T14:10:00-07:00",
  "endTime": "2026-05-12T15:00:00-07:00",
  "isAllDay": false,
  "source": "manual"
}
```

Behavior:

- Sets `provider` to `"manual"`.
- Sets `calendarId` to `"mvp-demo-calendar"`.
- Sets `status` to `"confirmed"`.

Response: `201` with the created event.

### PATCH `/api/calendar/events/[id]`

Updates a user-owned manual/mock event.

Accepted fields:

```json
{
  "title": "Updated event",
  "description": "Updated description",
  "location": "Library",
  "startTime": "2026-05-12T14:30:00-07:00",
  "endTime": "2026-05-12T15:30:00-07:00",
  "isAllDay": false,
  "source": "manual"
}
```

Response: `200` with the updated event.

### DELETE `/api/calendar/events/[id]`

Soft-deletes a user-owned manual/mock event by setting:

```json
{ "status": "cancelled" }
```

Response: `200` with the updated event.

## Schedule

### GET `/api/schedule?start=&end=`

Returns both fixed calendar events and scheduled work blocks for a date range.

Example:

```text
/api/schedule?start=2026-05-11T00:00:00-07:00&end=2026-05-18T00:00:00-07:00
```

Response:

```json
{
  "data": {
    "calendarEvents": [],
    "scheduledBlocks": [
      {
        "id": "demo_block_chem_review",
        "taskId": "demo_task_chem_midterm",
        "title": "Chem midterm practice set",
        "startTime": "2026-05-11T23:00:00.000Z",
        "endTime": "2026-05-12T00:30:00.000Z",
        "status": "accepted",
        "source": "scheduler",
        "task": {
          "id": "demo_task_chem_midterm",
          "title": "Study for chemistry midterm"
        }
      }
    ]
  }
}
```

### POST `/api/schedule/generate`

Generates proposed scheduled work blocks around calendar events and existing scheduled blocks.

Accepted body:

```json
{
  "planningCycleId": "demo_cycle_2026_05_11",
  "start": "2026-05-11T00:00:00-07:00",
  "end": "2026-05-18T00:00:00-07:00",
  "dryRun": false
}
```

All fields are optional, but `start` and `end` must be provided together. If no range is provided, the active planning cycle is used, then a seven-day fallback window.

Behavior:

- Uses incomplete tasks, user preferences, fixed calendar events, existing active scheduled blocks, and the latest daily check-in.
- Creates `proposed` scheduled blocks unless `dryRun` is `true`.
- Does not overlap non-cancelled calendar events or active scheduled blocks.
- Respects work hours, preferred block length, minimum breaks, daily total work limits, and daily hard-work limits.
- Prefers tasks with nearer due dates and higher priority.
- Returns unscheduled task reasons when work does not fit.

Example response:

```json
{
  "data": {
    "range": {
      "start": "2026-05-11T07:00:00.000Z",
      "end": "2026-05-18T07:00:00.000Z"
    },
    "dryRun": false,
    "scheduledBlocks": [
      {
        "id": "generated-block-id",
        "taskId": "demo_task_chem_midterm",
        "title": "Study for chemistry midterm",
        "startTime": "2026-05-11T17:30:00.000Z",
        "endTime": "2026-05-11T18:15:00.000Z",
        "status": "proposed",
        "source": "scheduler",
        "schedulingReason": "Priority 1, due in 3 days, deep-work task."
      }
    ],
    "unscheduledTasks": []
  }
}
```

## Dashboard

### GET `/api/dashboard/today?date=YYYY-MM-DD`

Returns the main payload for a single-day dashboard.

Example:

```text
/api/dashboard/today?date=2026-05-11
```

Validation:

- `date` is required.
- `date` must be in `YYYY-MM-DD` format.
- Invalid calendar dates, such as `2026-02-30`, are rejected.

Response:

```json
{
  "data": {
    "date": "2026-05-11",
    "checkin": {
      "id": "demo_checkin_2026_05_11",
      "energyScore": 4,
      "stressScore": 6,
      "aiInsights": []
    },
    "nextCalendarEvent": {
      "id": "demo_event_chem_lecture",
      "title": "CHE 118 lecture",
      "startTime": "2026-05-11T16:00:00.000Z",
      "endTime": "2026-05-11T17:20:00.000Z",
      "status": "confirmed"
    },
    "todayBlocks": [
      {
        "id": "demo_block_chem_review",
        "title": "Chem midterm practice set",
        "startTime": "2026-05-11T23:00:00.000Z",
        "endTime": "2026-05-12T00:30:00.000Z",
        "status": "accepted",
        "task": {
          "id": "demo_task_chem_midterm",
          "title": "Study for chemistry midterm"
        }
      }
    ],
    "topTasks": [
      {
        "id": "demo_task_chem_midterm",
        "title": "Study for chemistry midterm",
        "dueAt": "2026-05-14T22:30:00.000Z",
        "priority": 1,
        "status": "todo"
      }
    ],
    "insights": [
      {
        "id": "demo_insight_recovery_window",
        "scope": "daily",
        "title": "Protect a recovery window tonight",
        "severity": "caution"
      }
    ]
  }
}
```

Rules:

- `checkin` is today's check-in if present.
- `todayBlocks` are scheduled blocks whose `startTime` is on that date.
- `nextCalendarEvent` is the next non-cancelled calendar event after now if the requested date is today, otherwise after the start of the requested date.
- `topTasks` are incomplete tasks sorted by due date urgency, then priority.
- `insights` are the five most recent daily/weekly insights for the user.

## Insights

Insights are advisory. They can recommend schedule changes, breaks, recovery windows, and revised schedule generation, but they do not mutate scheduled blocks directly.

### GET `/api/insights/current?scope=&limit=`

Returns recent daily/weekly insights for the current user.

Query params:

- `scope`: optional, `daily` or `weekly`
- `limit`: optional integer from `1` to `20`, default `5`

Response:

```json
{
  "data": [
    {
      "id": "insight-id",
      "scope": "weekly",
      "insightType": "weekly_planning",
      "title": "This week needs a workload adjustment",
      "body": "High-priority work still has unscheduled estimated time.",
      "severity": "caution",
      "sourceData": {
        "recommendations": []
      }
    }
  ]
}
```

### POST `/api/insights/generate`

Generates and stores an advisory planning insight.

Accepted body:

```json
{
  "scope": "planning_session",
  "planningCycleId": "demo_cycle_2026_05_11",
  "start": "2026-05-11T00:00:00-07:00",
  "end": "2026-05-18T00:00:00-07:00",
  "trigger": "weekly_planning"
}
```

Validation:

- `scope` must be `daily`, `weekly`, or `planning_session`.
- `trigger` may be `manual`, `checkin`, `task_added`, or `weekly_planning`.
- `start` and `end` must be provided together.
- `date` may be used instead of `start`/`end` for day/week defaults.

Behavior:

- Reads tasks, task breakdowns, calendar events, scheduled blocks, and latest daily check-in.
- Weighs priority, due dates, cognitive load, estimated minutes, existing schedule pressure, energy, and stress.
- Stores the generated insight in `AiInsight`.
- Returns structured recommendations in `sourceData.recommendations`.
- Does not create, delete, or rewrite scheduled blocks.

Recommendation types:

- `work_now`
- `schedule_task`
- `move_block`
- `shorten_block`
- `skip_or_defer`
- `protect_break`
- `recovery_window`
- `regenerate_schedule`

## Chat And AI Actions

Chat is an input layer, not the source of truth. When a user creates a task or event through chat, the API writes real `Task` or `CalendarEvent` rows and stores an `AiAction` audit record.

The MVP parser is deterministic and lives in `lib/ai/mockParser.ts`. It detects simple text patterns:

- `add ... task`
- `due ...`
- `high priority`
- `medium priority`
- `low priority`
- `event`
- `appointment`
- `move`
- `complete`
- `schedule`

Supported action types:

- `CREATE_TASK`
- `CREATE_EVENT`
- `UPDATE_TASK`
- `GENERATE_SCHEDULE`

### POST `/api/chat/message`

Creates a user chat message, runs the mock parser, stores `AiAction` rows, optionally executes safe actions, and stores an assistant response.

Accepted body:

```json
{
  "threadId": "optional-existing-thread-id",
  "planningCycleId": "optional-cycle-id",
  "content": "add chemistry review task due 2026-05-14 high priority"
}
```

Behavior:

- If `threadId` is omitted, creates a new chat thread.
- Saves the user message.
- Parses actions from `content`.
- Creates `AiAction` rows for audit.
- Executes unambiguous `CREATE_TASK`, `CREATE_EVENT`, and `GENERATE_SCHEDULE` actions immediately.
- `complete` and other destructive/ambiguous updates require confirmation.
- Ambiguous updates return an assistant clarification message.

Example response:

```json
{
  "data": {
    "thread": {
      "id": "thread-id",
      "title": "add chemistry review task due 2026-05-14 high priority"
    },
    "userMessage": {
      "role": "user",
      "content": "add chemistry review task due 2026-05-14 high priority"
    },
    "assistantMessage": {
      "role": "assistant",
      "content": "I can add the task \"chemistry review\"."
    },
    "actions": [
      {
        "id": "action-id",
        "actionType": "CREATE_TASK",
        "status": "executed",
        "requiresConfirmation": false,
        "resultPayload": {
          "task": {
            "id": "task-id",
            "title": "chemistry review"
          }
        }
      }
    ]
  }
}
```

### GET `/api/chat/threads`

Returns current-user chat threads, sorted by latest update.

Response:

```json
{
  "data": [
    {
      "id": "thread-id",
      "title": "add chemistry review task due...",
      "messages": [],
      "aiActions": []
    }
  ]
}
```

### GET `/api/chat/threads/[id]/messages`

Returns all messages for a user-owned thread, including linked `AiAction` rows.

Response:

```json
{
  "data": [
    {
      "id": "message-id",
      "role": "user",
      "content": "complete chemistry review",
      "aiActions": [
        {
          "id": "action-id",
          "actionType": "UPDATE_TASK",
          "status": "proposed",
          "requiresConfirmation": true
        }
      ]
    }
  ]
}
```

### POST `/api/ai-actions/[id]/confirm`

Confirms a proposed AI action.

Behavior:

- Only user-owned actions can be confirmed.
- Only `proposed` actions can be confirmed.
- Ambiguous actions cannot be confirmed until clarified.
- `UPDATE_TASK` with `operation: "complete"` marks the matched task completed.

Response:

```json
{
  "data": {
    "id": "action-id",
    "status": "executed",
    "resultPayload": {
      "task": {
        "id": "task-id",
        "status": "completed"
      }
    }
  }
}
```

### POST `/api/ai-actions/[id]/cancel`

Cancels a proposed AI action.

Response:

```json
{
  "data": {
    "id": "action-id",
    "status": "cancelled"
  }
}
```

## Uploaded Inputs

These endpoints are MVP-only and JSON-based. There is no production file storage and no live voice agent. If multipart upload handling is added later, these routes can be extended without changing the core database model.

### POST `/api/uploads/image`

Creates an `UploadedInput` row for an image-like input and returns mock parsed items plus proposed `AiAction` rows.

Accepted body:

```json
{
  "fileUrl": "https://example.com/mock-schedule.png",
  "rawTextExtracted": "Optional OCR text from the image"
}
```

Behavior:

- Creates `UploadedInput` with `sourceType: "image"`.
- Uses a deterministic mock parser.
- If no real parser exists, returns one sample `calendar_event`.
- Creates proposed `AiAction` rows for audit and confirmation.
- Does not create a real `CalendarEvent` immediately.

Response:

```json
{
  "data": {
    "uploadedInput": {
      "id": "uploaded-input-id",
      "sourceType": "image",
      "fileUrl": "https://example.com/mock-schedule.png",
      "status": "parsed"
    },
    "parsedItems": [
      {
        "type": "calendar_event",
        "title": "Review uploaded schedule item",
        "startTime": "2026-05-12T14:00:00-07:00",
        "endTime": "2026-05-12T15:00:00-07:00",
        "source": "image"
      }
    ],
    "proposedActions": [
      {
        "id": "action-id",
        "actionType": "CREATE_EVENT",
        "status": "proposed",
        "requiresConfirmation": true
      }
    ]
  }
}
```

### POST `/api/uploads/voice`

Creates an `UploadedInput` row for a voice-like input and parses its transcript through the same chat mock parser.

Accepted body:

```json
{
  "fileUrl": "https://example.com/mock-audio.m4a",
  "rawTextExtracted": "add chemistry review task due 2026-05-14 high priority"
}
```

Behavior:

- Creates `UploadedInput` with `sourceType: "voice"`.
- Treats `rawTextExtracted` as the transcript.
- Passes the transcript through `lib/ai/mockParser.ts`.
- Creates proposed `AiAction` rows for audit.
- Does not implement a live voice agent.

Response:

```json
{
  "data": {
    "uploadedInput": {
      "id": "uploaded-input-id",
      "sourceType": "voice",
      "rawTextExtracted": "add chemistry review task due 2026-05-14 high priority",
      "status": "parsed"
    },
    "parsedItems": [
      {
        "type": "create_task",
        "actionType": "CREATE_TASK",
        "requiresConfirmation": false,
        "inputPayload": {
          "title": "chemistry review",
          "priority": 1
        }
      }
    ],
    "proposedActions": [
      {
        "id": "action-id",
        "actionType": "CREATE_TASK",
        "status": "proposed",
        "requiresConfirmation": true
      }
    ]
  }
}
```
```

## Scheduled Blocks

Scheduled blocks are proposed or accepted work sessions for tasks.

### PATCH `/api/scheduled-blocks/[id]`

Updates a user-owned scheduled block.

Accepted fields:

```json
{
  "title": "CS project implementation sprint",
  "startTime": "2026-05-12T10:00:00-07:00",
  "endTime": "2026-05-12T11:30:00-07:00",
  "status": "accepted"
}
```

Validation:

- Unknown fields are rejected.
- Empty patch bodies are rejected.
- If both `startTime` and `endTime` are provided, `endTime` must be after `startTime`.
- If only one time is provided, the API validates against the existing other time.

Response: `200` with the updated scheduled block, including related `task` and `taskBreakdown`.

### POST `/api/scheduled-blocks/[id]/complete`

Marks a scheduled block as completed.

Behavior:

- Sets the block `status` to `"completed"`.
- If the block has a task:
  - If all active scheduled blocks for that task are now completed/cancelled/skipped, marks the task `"completed"`.
  - Otherwise marks the task `"in_progress"`.

Response:

```json
{
  "data": {
    "scheduledBlock": {
      "id": "demo_block_chem_review",
      "status": "completed"
    },
    "task": {
      "id": "demo_task_chem_midterm",
      "status": "in_progress"
    }
  }
}
```

### POST `/api/scheduled-blocks/[id]/skip`

Marks a scheduled block as skipped and returns a simple deterministic reschedule suggestion when possible.

Behavior:

- Sets the block `status` to `"skipped"`.
- Looks for the next same-day opening after the skipped block.
- Avoids overlapping non-cancelled calendar events and active scheduled blocks.
- Returns `suggestion: null` if no same-day slot is found.

Response:

```json
{
  "data": {
    "scheduledBlock": {
      "id": "demo_block_chem_review",
      "status": "skipped"
    },
    "suggestion": {
      "startTime": "2026-05-11T18:00:00.000Z",
      "endTime": "2026-05-11T19:30:00.000Z",
      "reason": "Next same-day opening with no calendar event or active scheduled block conflict."
    }
  }
}
```

## Seed Data

Run:

```bash
npm run seed
```

Creates one demo user with:

- User preferences
- One active planning cycle
- Five student tasks
- Four lecture/calendar events
- Two scheduled blocks
- One daily check-in
- Two AI insights

The seed is idempotent and can be re-run.

## Useful Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run seed
```

## Current MVP Limitations

- Auth is mocked.
- Google Calendar OAuth is not implemented.
- Task breakdown generation is deterministic, not AI-generated.
- Reschedule suggestions are simple same-day suggestions, not full optimization.
- API writes directly to core tables; future AI actions should use confirmation flows for risky changes.

## Daily Check-Ins

Daily check-ins capture student capacity for a single date. They intentionally do not include mood or sleep fields.

### POST `/api/checkins/daily`

Creates or updates one check-in per user per date.

Accepted body:

```json
{
  "planningCycleId": "demo_cycle_2026_05_11",
  "checkinDate": "2026-05-11",
  "energyScore": 2,
  "stressScore": 6,
  "availableCapacityMinutes": 120,
  "userNote": "Feeling overloaded.",
  "adjustToday": true
}
```

Validation:

- `checkinDate` is required and must start with `YYYY-MM-DD`.
- `energyScore` is required and must be an integer from `1` to `7`.
- `stressScore` is required and must be an integer from `1` to `7`.
- `availableCapacityMinutes` is optional and must be `0` or greater.
- `userNote` is optional.
- `adjustToday` is optional.
- Unknown fields are rejected, including `mood` and `sleep` fields.
- If `planningCycleId` is provided, it must belong to the current user.

Behavior:

- Saves one check-in per user per date.
- If a check-in already exists for that date, updates it.
- If `adjustToday` is `true`, creates or updates a daily `AiInsight`.
- If `energyScore <= 2` or `stressScore >= 6`, the insight recommends a lighter plan.

Response:

```json
{
  "data": {
    "checkin": {
      "id": "checkin-id",
      "checkinDate": "2026-05-11T00:00:00.000Z",
      "energyScore": 2,
      "stressScore": 6,
      "availableCapacityMinutes": 120,
      "userNote": "Feeling overloaded."
    },
    "insight": {
      "id": "demo_daily_adjustment_2026_05_11",
      "insightType": "low_energy_plan",
      "title": "Use a lighter plan today",
      "severity": "caution"
    }
  }
}
```

### GET `/api/checkins?start=&end=`

Returns user-scoped check-ins between `start` and `end`.

Example:

```text
/api/checkins?start=2026-05-11T00:00:00Z&end=2026-05-18T00:00:00Z
```

Response:

```json
{
  "data": [
    {
      "id": "checkin-id",
      "checkinDate": "2026-05-11T00:00:00.000Z",
      "energyScore": 2,
      "stressScore": 6,
      "aiInsights": []
    }
  ]
}
```

### POST `/api/schedule/adjust-today`

Returns simple MVP adjustment suggestions for today.

Behavior:

- Looks at today's user-scoped scheduled blocks.
- Finds blocks tied to tasks with `cognitiveLoad >= 6`.
- Returns simple suggestions to shorten, move, or swap demanding work.
- Does not rewrite the schedule automatically.

Response:

```json
{
  "data": {
    "date": "2026-05-09",
    "summary": "High cognitive-load blocks found for today.",
    "suggestedAdjustments": [
      {
        "scheduledBlockId": "block-id",
        "taskId": "task-id",
        "title": "Chem midterm practice set",
        "currentStartTime": "2026-05-09T20:00:00.000Z",
        "currentEndTime": "2026-05-09T21:30:00.000Z",
        "cognitiveLoad": 7,
        "suggestion": "Consider shortening this block, moving it later, or replacing it with a lower-load task if today's check-in is low energy or high stress."
      }
    ]
  }
}
