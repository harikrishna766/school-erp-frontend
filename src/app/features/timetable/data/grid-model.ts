import { derivePalette } from '../../../core/theme/color';
import type {
  Conflict,
  ConflictKind,
  ConflictSeverity,
  PeriodSlot,
  TimetableEntry,
  TimetableLookups,
  ViewMode,
  Weekday,
} from './timetable.models';

/** Which entries a grid shows: one section, one teacher or one room. */
export interface GridView {
  readonly mode: ViewMode;
  readonly targetId: string;
}

export interface CellColors {
  readonly bgLight: string;
  readonly fgLight: string;
  readonly bgDark: string;
  readonly fgDark: string;
}

export interface GridConflict {
  readonly severity: ConflictSeverity;
  readonly kinds: readonly ConflictKind[];
  readonly messages: readonly string[];
}

/** Display model of one entry inside a cell. */
export interface GridEntry {
  readonly id: string;
  readonly day: Weekday;
  readonly slotIndex: number;
  /** Subject code, e.g. 'MATH'. */
  readonly title: string;
  /** Depends on the view: teacher/room (section view), section/room (teacher view)… */
  readonly subtitle: string;
  /** Full description for screen readers and tooltips. */
  readonly description: string;
  readonly colors: CellColors;
  readonly locked: boolean;
  readonly conflict: GridConflict | null;
}

export const cellKey = (day: number, slotIndex: number): string => `${day}:${slotIndex}`;

const FALLBACK_COLORS: CellColors = {
  bgLight: '#eef0f4',
  fgLight: '#1b1c20',
  bgDark: '#2a2c31',
  fgDark: '#e3e2e6',
};

const colorCache = new Map<string, CellColors>();

/** Subject colour → light/dark cell colours with ≥ 4.5:1 text contrast. */
export function subjectColors(hex: string): CellColors {
  let colors = colorCache.get(hex);
  if (!colors) {
    const palette = derivePalette(hex);
    colors = palette
      ? {
          bgLight: palette.containerLight,
          fgLight: palette.onContainerLight,
          bgDark: palette.containerDark,
          fgDark: palette.onContainerDark,
        }
      : FALLBACK_COLORS;
    colorCache.set(hex, colors);
  }
  return colors;
}

export function entriesForView(
  entries: readonly TimetableEntry[],
  view: GridView,
): TimetableEntry[] {
  switch (view.mode) {
    case 'section':
      return entries.filter((e) => e.sectionId === view.targetId);
    case 'teacher':
      return entries.filter((e) => e.teacherId === view.targetId);
    case 'room':
      return entries.filter((e) => e.roomId === view.targetId);
  }
}

/** entryId → merged conflict (HARD wins over SOFT). */
export function conflictsByEntry(conflicts: readonly Conflict[]): Map<string, GridConflict> {
  const map = new Map<string, GridConflict>();
  for (const c of conflicts) {
    for (const id of c.entryIds) {
      const prev = map.get(id);
      map.set(id, {
        severity: prev?.severity === 'HARD' || c.severity === 'HARD' ? 'HARD' : 'SOFT',
        kinds: [...(prev?.kinds ?? []), c.kind],
        messages: [...(prev?.messages ?? []), c.message],
      });
    }
  }
  return map;
}

export interface LookupIndex {
  readonly subjects: ReadonlyMap<string, TimetableLookups['subjects'][number]>;
  readonly teachers: ReadonlyMap<string, TimetableLookups['teachers'][number]>;
  readonly rooms: ReadonlyMap<string, TimetableLookups['rooms'][number]>;
  readonly sections: ReadonlyMap<string, TimetableLookups['sections'][number]>;
}

export function indexLookups(lookups: TimetableLookups): LookupIndex {
  return {
    subjects: new Map(lookups.subjects.map((s) => [s.id, s])),
    teachers: new Map(lookups.teachers.map((t) => [t.id, t])),
    rooms: new Map(lookups.rooms.map((r) => [r.id, r])),
    sections: new Map(lookups.sections.map((s) => [s.id, s])),
  };
}

export function toGridEntry(
  entry: TimetableEntry,
  mode: ViewMode,
  index: LookupIndex,
  conflicts: ReadonlyMap<string, GridConflict>,
): GridEntry {
  const subject = index.subjects.get(entry.subjectId);
  const teacher = index.teachers.get(entry.teacherId);
  const room = entry.roomId ? index.rooms.get(entry.roomId) : undefined;
  const section = index.sections.get(entry.sectionId);
  const parts: Record<ViewMode, (string | undefined)[]> = {
    section: [teacher?.shortName, room?.name],
    teacher: [section?.name, room?.name],
    room: [section?.name, teacher?.shortName],
  };
  return {
    id: entry.id,
    day: entry.day,
    slotIndex: entry.slotIndex,
    title: subject?.code ?? '?',
    subtitle: parts[mode].filter(Boolean).join(' · '),
    description: [subject?.name, section?.name, teacher?.name, room?.name]
      .filter(Boolean)
      .join(', '),
    colors: subject ? subjectColors(subject.color) : FALLBACK_COLORS,
    locked: entry.locked,
    conflict: conflicts.get(entry.id) ?? null,
  };
}

/** Cell key → entries (a clash shows several entries in one cell). */
export function buildCells(
  entries: readonly TimetableEntry[],
  mode: ViewMode,
  index: LookupIndex,
  conflicts: ReadonlyMap<string, GridConflict>,
): Map<string, GridEntry[]> {
  const cells = new Map<string, GridEntry[]>();
  for (const entry of entries) {
    const key = cellKey(entry.day, entry.slotIndex);
    const list = cells.get(key) ?? [];
    list.push(toGridEntry(entry, mode, index, conflicts));
    cells.set(key, list);
  }
  return cells;
}

/** True if the slot exists for that day (half days end early; breaks aren't teachable). */
export function isTeachable(
  slot: PeriodSlot,
  day: Weekday,
  lastSlotByDay: Readonly<Partial<Record<Weekday, number>>>,
): boolean {
  const last = lastSlotByDay[day];
  return slot.kind === 'TEACHING' && (last === undefined || slot.index <= last);
}
