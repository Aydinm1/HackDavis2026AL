# API Reference

All endpoints are under `/api`. Authentication uses a mocked user (MVP). All requests/responses use JSON.

---

## Chat

### `POST /api/chat/message`

Send a message. Creates a thread if `threadId` is omitted. Runs the Gemini AI parser and executes or stages any detected actions.

**Request body**
| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | yes | Natural language message |
| `threadId` | string | no | Re-use existing thread |
| `planningCycleId` | string | no | Link to a planning cycle |

**Response `201`**
```json
{
  "data": {
    "thread": { "id": "...", "title": "...", "updatedAt": "..." },
    "userMessage": { "id": "...", "role": "user", "content": "..." },
    "assistantMessage": { "id": "...", "role": "assistant", "content": "..." },
    "actions": [
      {
        "id": "...",
        "actionType": "CREATE_TASK",
        "status": "executed",
        "requiresConfirmation": false,
        "inputPayload": { "title": "...", "dueAt": "...", "priority": 2, "cognitiveLoad": 5 },
        "resultPayload": { "task": { "id": "...", "title": "..." } }
      }
    ]
  }
}
```

**Action types**
| `actionType` | Triggered when | Auto-executes |
|---|---|---|
| `CREATE_TASK` | User describes a to-do | Yes, if not ambiguous |
| `CREATE_EVENT` | User mentions an event/appointment | Yes, if title + time present |
| `UPDATE_TASK` | User wants to complete or move a task | No — requires confirmation |
| `GENERATE_SCHEDULE` | User asks to plan their day | Yes (MVP stub) |

---

### `GET /api/chat/threads`

List all threads for the current user, most recent first.

**Response `200`**
```json
{ "data": [ { "id": "...", "title": "...", "updatedAt": "...", "messages": [...], "aiActions": [...] } ] }
```

---

### `GET /api/chat/threads/:id/messages`

List all messages in a thread, oldest first. Each message includes its linked `aiActions`.

**Response `200`**
```json
{ "data": [ { "id": "...", "role": "user", "content": "...", "aiActions": [] } ] }
```

---

## AI Actions

### `POST /api/ai-actions/:id/confirm`

Execute a staged action that required confirmation. Fails if action is not in `proposed` status or is still ambiguous.

**Response `200`** — updated action with `status: "executed"` and `resultPayload`.

---

### `POST /api/ai-actions/:id/cancel`

Cancel a proposed action without executing it.

**Response `200`** — updated action with `status: "cancelled"`.

---

## Tasks

### `GET /api/tasks`

List all tasks for the current user.

---

### `POST /api/tasks`

Create a task manually.

**Request body**
| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `type` | string | yes | `school`, `work`, `personal`, `health`, `chores` |
| `workType` | string | yes | `focus`, `study`, `admin`, `creative`, `physical` |
| `timeframe` | string | yes | `daily`, `weekly`, `monthly` |
| `priority` | number | no | 1 (highest) – 5 (lowest) |
| `cognitiveLoad` | number | no | 1 (easy) – 7 (hard) |
| `dueAt` | ISO string | no | |
| `estimatedMinutes` | number | no | |
| `canSplit` | boolean | no | |
| `planningCycleId` | string | no | |

---

### `PATCH /api/tasks/:id`

Update mutable fields. Same fields as POST (all optional).

---

### `POST /api/tasks/:id/complete`

Mark a task complete.

**Request body:** `{ "actualMinutes": 45 }` (optional)

---

### `POST /api/tasks/:id/breakdown`

Generate an AI-powered subtask breakdown (MVP stub).

---

## Calendar Events

### `GET /api/calendar/events?start=<ISO>&end=<ISO>`

List events in a time range.

---

### `POST /api/calendar/events`

Create a calendar event.

**Request body**
| Field | Type | Required |
|---|---|---|
| `title` | string | yes |
| `startTime` | ISO string | yes |
| `endTime` | ISO string | yes |
| `isAllDay` | boolean | no |
| `description` | string | no |
| `location` | string | no |
| `source` | string | no |

---

### `PATCH /api/calendar/events/:id`

Update `title`, `description`, `location`, `startTime`, `endTime`, `isAllDay`.

---

### `DELETE /api/calendar/events/:id`

Delete an event.

---

## Scheduled Blocks

### `PATCH /api/scheduled-blocks/:id`

Update `title`, `startTime`, `endTime`, `status`.

---

### `POST /api/scheduled-blocks/:id/complete`

Mark a block complete. Accepts `{ "actualMinutes": number }`.

---

### `POST /api/scheduled-blocks/:id/skip`

Skip a block.

---

## Check-ins

### `GET /api/checkins`

List all check-ins for the current user.

---

### `POST /api/checkins/daily`

Submit a daily check-in.

**Request body**
| Field | Type | Required | Range |
|---|---|---|---|
| `checkinDate` | `YYYY-MM-DD` | yes | |
| `energyScore` | number | yes | 1–7 |
| `stressScore` | number | yes | 1–7 |
| `availableCapacityMinutes` | number | no | |
| `userNote` | string | no | |
| `adjustToday` | boolean | no | Re-runs scheduling if true |
| `planningCycleId` | string | no | |

---

## Schedule

### `GET /api/schedule`

Generate a proposed schedule from pending tasks and calendar events.

---

### `POST /api/schedule/adjust-today`

Re-run today's schedule based on latest check-in and task states.

---

## Dashboard

### `GET /api/dashboard/today?date=YYYY-MM-DD`

Returns today's tasks, events, scheduled blocks, and latest check-in in a single response.

---

## Uploads

### `POST /api/uploads/image`

Submit a parsed image payload (screenshot of a syllabus, schedule, etc.).

**Request body:** `{ "fileUrl": "...", "rawTextExtracted": "..." }` (at least one required)

---

### `POST /api/uploads/voice`

Submit a voice transcript as text.

**Request body:** `{ "transcript": "..." }`

---

## Error format

All errors return:
```json
{ "error": "Human-readable message." }
```

Common status codes: `400` bad input, `404` not found, `500` server error.
