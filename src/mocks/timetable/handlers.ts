import { delay, http } from 'msw';
import type {
  MoveRequest,
  TimetableEntry,
  TimetableLookups,
  ValidateResult,
} from '../../app/features/timetable/data/timetable.models';
import { authenticate } from '../auth/handlers';
import { fail, ok } from '../envelope';
import { detectConflicts } from './conflicts';
import { ROOMS, SECTIONS, SUBJECTS, TEACHERS, TEMPLATE, initialVersions } from './seed';

const api = (path: string): string => `*/api/v1/timetable${path}`;
const pathOf = (r: Request) => new URL(r.url).pathname;

/** In-memory "database"; a reload starts from the seed. */
const db = initialVersions();

const LOOKUPS: TimetableLookups = {
  template: TEMPLATE,
  subjects: SUBJECTS,
  teachers: TEACHERS,
  rooms: ROOMS,
  sections: SECTIONS,
};

const versionEntries = (versionId: string) => db.entries.filter((e) => e.versionId === versionId);

/** The mock treats any authenticated user as allowed to read; edits need a draft. */
export const timetableHandlers = [
  http.get(api('/lookups'), async ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    await delay(150);
    return ok(LOOKUPS);
  }),

  http.get(api('/versions'), async ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    await delay(100);
    return ok(db.versions);
  }),

  http.get(api('/versions/:id/entries'), async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    await delay(200);
    return ok(versionEntries(String(params['id'])));
  }),

  http.get(api('/versions/:id/conflicts'), async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    return ok(detectConflicts(versionEntries(String(params['id']))));
  }),

  http.post(api('/versions/:id/moves'), async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    await delay(250);
    const versionId = String(params['id']);
    const version = db.versions.find((v) => v.id === versionId);
    if (!version) return fail(404, 'NOT_FOUND', 'Version not found', pathOf(request));
    if (version.status !== 'DRAFT') {
      return fail(409, 'CONFLICT', 'Only draft versions can be edited', pathOf(request));
    }
    const body = (await request.json()) as MoveRequest;
    const moving = db.entries.find((e) => e.id === body.entryId && e.versionId === versionId);
    const other = body.swapWithEntryId
      ? db.entries.find((e) => e.id === body.swapWithEntryId && e.versionId === versionId)
      : undefined;
    if (!moving || (body.swapWithEntryId && !other)) {
      return fail(404, 'NOT_FOUND', 'Entry not found', pathOf(request));
    }
    if (moving.locked || other?.locked) {
      return fail(409, 'CONFLICT', 'Locked entries cannot be moved', pathOf(request));
    }
    const changed: TimetableEntry[] = [];
    const from = { day: moving.day, slotIndex: moving.slotIndex };
    const update = (entry: TimetableEntry, day: TimetableEntry['day'], slotIndex: number) => {
      const next = { ...entry, day, slotIndex };
      db.entries[db.entries.indexOf(entry)] = next;
      changed.push(next);
    };
    update(moving, body.toDay, body.toSlotIndex);
    if (other) {
      update(other, from.day, from.slotIndex);
    }
    const result: ValidateResult = {
      changed,
      conflicts: detectConflicts(versionEntries(versionId)),
    };
    return ok(result);
  }),

  http.patch(api('/versions/:id/entries/:entryId'), async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const { locked } = (await request.json()) as { locked: boolean };
    const index = db.entries.findIndex(
      (e) => e.id === params['entryId'] && e.versionId === params['id'],
    );
    if (index < 0) return fail(404, 'NOT_FOUND', 'Entry not found', pathOf(request));
    db.entries[index] = { ...db.entries[index], locked };
    return ok(db.entries[index]);
  }),
];
