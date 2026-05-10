# Demo Prompts

Use these prompts for the backend/AI demo. They are covered by parser or chat tests so they should stay stable.

## Read-Only Overview

Prompt:

```text
what do i have going on today
```

Expected:

- Answers from existing DB data.
- Does not create an AI action.
- Does not show the parser fallback error.

## Task Creation With Review

Prompt:

```text
i have a bio midterm on wednesday that i highkey dont really know much for its at 1pm i gotta lock in and study for it
```

Expected:

- Proposes a study task for the bio midterm.
- Proposes a one-hour bio midterm calendar event.
- Requires confirmation before saving inferred task/event details.

## Schedule Preview

Prompt:

```text
when would be a good time to do my math homework
```

Expected:

- Creates a `GENERATE_SCHEDULE` proposal.
- Uses dry-run preview behavior before saving scheduled blocks.

## Daily Stress/Energy Check-In

Prompt:

```text
I'm stressed 7 and energy 2, what should I do today?
```

Expected:

- Creates a `DAILY_CHECKIN` action with stress 7 and energy 2.
- Also creates an `ADJUST_TODAY` action/suggestion.

## Calendar Event Creation

Prompt:

```text
I want lunch at 2:00PM for about 30 minutes
```

Expected:

- Creates a lunch calendar event from 2:00 PM to 2:30 PM.

## Event Update

Prompt:

```text
I have this presentation, but it got moved to 7:00PM-9:00PM
```

Expected:

- Proposes an `UPDATE_EVENT` action for the presentation.
- Sets the new two-hour time range.
- Requires confirmation.

## Task Update Follow-Up

Prompt:

```text
difficulty 7 priority 3
```

Expected when there is a pending task proposal:

- Updates the pending `CREATE_TASK` payload.
- Does not create a separate confusing `UPDATE_TASK` action.

## Avoid For Demo

- Duplicate task creation prompts unless the duplicate-check flow is the point of the demo.
- Vague prompts without dates/times like `add an event sometime soon`.
- Prompts that require real frontend confirmation cards unless the UI is currently verified.
