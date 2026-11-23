# Timetable API: proposed contract

`school-erp-backend` has timetable **permissions** (`timetable:template|requirement|version|entry|substitution|report:*`)
but no timetable models or endpoints yet. This is what the frontend is built against today, through
typed MSW mocks (`src/mocks/timetable/`) and provisional types
(`src/app/features/timetable/data/timetable.models.ts`). When the backend implements it,
`npm run api:update` generates the real client and the provisional types are swapped for it;
the store and components keep their API.

All responses use the standard envelope; payloads are shown unwrapped. Base path `/api/v1/timetable`.

## Read (step 1, built)

| Method & path                  | Permission               | Response                                                                                       |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /lookups`                 | `timetable:version:view` | `{ template, subjects, teachers, rooms, sections }` for the active branch                      |
| `GET /versions`                | `timetable:version:view` | `TimetableVersion[]`                                                                           |
| `GET /versions/{id}/entries`   | `timetable:version:view` | `TimetableEntry[]`, scoped by the caller's data scope (SELF / SECTION / OWN_CHILDREN / BRANCH) |
| `GET /versions/{id}/conflicts` | `timetable:version:view` | `Conflict[]`                                                                                   |

```ts
PeriodTemplate { id, name, days: Weekday[] /* 1=Mon … 7=Sun */, slots: PeriodSlot[], lastSlotByDay: { [day]: lastSlotIndex } }
PeriodSlot     { index, start: 'HH:mm', end: 'HH:mm', kind: 'TEACHING'|'BREAK'|'LUNCH'|'ASSEMBLY', label }
Subject        { id, name, code, color /* hex */ }
Teacher        { id, name, shortName }
Room           { id, name, capacity|null }
SectionRef     { id, name, classId }
TimetableVersion { id, name, status: 'DRAFT'|'PUBLISHED'|'ARCHIVED', templateId, createdAt, publishedAt|null, score|null }
TimetableEntry { id, versionId, sectionId, day, slotIndex, subjectId, teacherId, roomId|null, locked }
Conflict       { kind, severity: 'HARD'|'SOFT', entryIds[], day, slotIndex, message }
```

Conflict kinds: `TEACHER_CLASH`, `ROOM_CLASH`, `SECTION_CLASH`, `OUTSIDE_TEMPLATE` (HARD);
`TEACHER_UNAVAILABLE` (HARD), `TEACHER_MAX_PER_DAY`, `SUBJECT_MAX_PER_DAY`, `ROOM_UNSUITABLE`
(SOFT). The UI translates by `kind`; `message` is kept as detail. Homerooms (`room-sec-*` in
mocks) don't produce room clashes.

## Edit (store + grid support built; editor screen is step 4)

| Method & path                            | Permission             | Body → response                                                                                              |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /versions/{id}/moves`              | `timetable:entry:edit` | `{ entryId, toDay, toSlotIndex, swapWithEntryId? }` → `{ changed: TimetableEntry[], conflicts: Conflict[] }` |
| `PATCH /versions/{id}/entries/{entryId}` | `timetable:entry:edit` | `{ locked }` → `TimetableEntry`                                                                              |

- Only `DRAFT` versions are editable: otherwise `409 CONFLICT`.
- Locked entries can't be moved or swapped: `409 CONFLICT`.
- Moves are applied even when they create conflicts (so users can fix them step by step); the
  response always carries **all** conflicts of the version.
- Proposed: `If-Match`/version counter on moves to detect concurrent editors (`409 CONFLICT` →
  "reload"; the UI already maps it to `timetable.errors.staleVersion`).

## Still to specify (steps 2–6)

- Setup: period templates, rooms, subject requirements per section (bulk + copy), teacher
  availability/max load (`timetable:template:manage`, `timetable:requirement:manage`).
- Generation: `POST /versions/{id}/generate { sectionIds?, keepLocked }` → `{ jobId }`;
  `POST /jobs/{jobId}/cancel`; realtime on room `timetable-job:{jobId}`, event
  `timetable.generation`:
  `{ jobId, versionId, status: 'QUEUED'|'RUNNING'|'COMPLETED'|'INFEASIBLE'|'FAILED'|'CANCELLED', progress: 0..1, score, hardViolations, softPenalty }`;
  diagnostics for INFEASIBLE with links to the data to fix (`timetable:version:generate`). The
  gateway's `RoomAuthorizerRegistry` needs a `timetable-job` prefix authorizer.
- Diff between versions, publish with summary (`timetable:version:publish`).
- Substitutions (`timetable:substitution:view|assign|respond`) with realtime status.
- Exports (PDF/Excel/iCal) (`timetable:report:view`).
