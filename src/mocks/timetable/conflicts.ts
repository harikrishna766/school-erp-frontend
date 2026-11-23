import { isTeachable } from '../../app/features/timetable/data/grid-model';
import type {
  Conflict,
  ConflictKind,
  TimetableEntry,
} from '../../app/features/timetable/data/timetable.models';
import { TEMPLATE } from './seed';

/** Same rules the backend validator is proposed to apply (docs/timetable-contract.md). */
export function detectConflicts(entries: readonly TimetableEntry[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const groups = (key: (e: TimetableEntry) => string | null) => {
    const map = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const k = key(e);
      if (k) map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.values()];
  };
  const clash = (kind: ConflictKind, label: string, key: (e: TimetableEntry) => string | null) => {
    for (const group of groups(key)) {
      if (group.length > 1) {
        conflicts.push({
          kind,
          severity: 'HARD',
          entryIds: group.map((e) => e.id),
          day: group[0].day,
          slotIndex: group[0].slotIndex,
          message: `${label} double-booked`,
        });
      }
    }
  };
  clash('TEACHER_CLASH', 'Teacher', (e) => `${e.teacherId}:${e.day}:${e.slotIndex}`);
  clash('SECTION_CLASH', 'Section', (e) => `${e.sectionId}:${e.day}:${e.slotIndex}`);
  clash('ROOM_CLASH', 'Room', (e) =>
    e.roomId && !e.roomId.startsWith('room-sec-') ? `${e.roomId}:${e.day}:${e.slotIndex}` : null,
  );

  for (const e of entries) {
    const slot = TEMPLATE.slots.find((s) => s.index === e.slotIndex);
    if (!slot || !isTeachable(slot, e.day, TEMPLATE.lastSlotByDay)) {
      conflicts.push({
        kind: 'OUTSIDE_TEMPLATE',
        severity: 'HARD',
        entryIds: [e.id],
        day: e.day,
        slotIndex: e.slotIndex,
        message: 'Not a teaching period',
      });
    }
  }
  for (const group of groups((e) => `${e.sectionId}:${e.subjectId}:${e.day}`)) {
    if (group.length > 2) {
      conflicts.push({
        kind: 'SUBJECT_MAX_PER_DAY',
        severity: 'SOFT',
        entryIds: group.map((e) => e.id),
        day: group[0].day,
        slotIndex: group[0].slotIndex,
        message: 'More than 2 periods of a subject in a day',
      });
    }
  }
  for (const group of groups((e) => `${e.teacherId}:${e.day}`)) {
    if (group.length > 6) {
      conflicts.push({
        kind: 'TEACHER_MAX_PER_DAY',
        severity: 'SOFT',
        entryIds: group.map((e) => e.id),
        day: group[0].day,
        slotIndex: group[0].slotIndex,
        message: 'Teacher has more than 6 periods in a day',
      });
    }
  }
  return conflicts;
}
