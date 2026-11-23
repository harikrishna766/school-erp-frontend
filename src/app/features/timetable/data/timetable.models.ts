/*
 * PROVISIONAL timetable contract. school-erp-backend has no timetable models/endpoints
 * yet (only the `timetable:*` permissions). These types are the frontend's proposal,
 * documented in docs/timetable-contract.md and served by MSW mocks. When the backend
 * ships the module, `npm run api:update` generates the real models; this file then
 * re-exports them and the store/grid keep their API.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SlotKind = 'TEACHING' | 'BREAK' | 'LUNCH' | 'ASSEMBLY';

/** One row of the period template (same times every working day). */
export interface PeriodSlot {
  /** 0-based position in the day. */
  readonly index: number;
  /** 'HH:mm' (24h, school-local time). */
  readonly start: string;
  readonly end: string;
  readonly kind: SlotKind;
  /** Short label, e.g. 'P1', 'Lunch'. */
  readonly label: string;
}

export interface PeriodTemplate {
  readonly id: string;
  readonly name: string;
  readonly days: readonly Weekday[];
  readonly slots: readonly PeriodSlot[];
  /** Days with fewer teaching slots (e.g. Saturday half day): day → last slot index. */
  readonly lastSlotByDay: Readonly<Partial<Record<Weekday, number>>>;
}

export interface Subject {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  /** Hex colour used to tint cells; contrast is fixed up client-side. */
  readonly color: string;
}

export interface Teacher {
  readonly id: string;
  readonly name: string;
  /** Initials / short code shown in dense cells. */
  readonly shortName: string;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly capacity: number | null;
}

export interface SectionRef {
  readonly id: string;
  /** e.g. '7-A' */
  readonly name: string;
  readonly classId: string;
}

export type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface TimetableVersion {
  readonly id: string;
  readonly name: string;
  readonly status: VersionStatus;
  readonly templateId: string;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  /** Solver score (higher is better), null for hand-made versions. */
  readonly score: number | null;
}

export interface TimetableEntry {
  readonly id: string;
  readonly versionId: string;
  readonly sectionId: string;
  readonly day: Weekday;
  readonly slotIndex: number;
  readonly subjectId: string;
  readonly teacherId: string;
  readonly roomId: string | null;
  /** Locked entries are kept by the generator and can't be moved in the editor. */
  readonly locked: boolean;
}

export type ConflictKind =
  | 'TEACHER_CLASH'
  | 'ROOM_CLASH'
  | 'SECTION_CLASH'
  | 'TEACHER_UNAVAILABLE'
  | 'TEACHER_MAX_PER_DAY'
  | 'SUBJECT_MAX_PER_DAY'
  | 'ROOM_UNSUITABLE'
  | 'OUTSIDE_TEMPLATE';

export type ConflictSeverity = 'HARD' | 'SOFT';

export interface Conflict {
  readonly kind: ConflictKind;
  readonly severity: ConflictSeverity;
  readonly entryIds: readonly string[];
  readonly day: Weekday;
  readonly slotIndex: number;
  /** Server message (English); the UI shows a translated text by `kind` and keeps this as detail. */
  readonly message: string;
}

/** A proposed change, validated server-side before it is saved. */
export interface MoveRequest {
  readonly entryId: string;
  readonly toDay: Weekday;
  readonly toSlotIndex: number;
  /** If another (unlocked) entry occupies the target in the same view, swap with it. */
  readonly swapWithEntryId?: string;
}

export interface ValidateResult {
  /** Entries after applying the change (only those that changed). */
  readonly changed: readonly TimetableEntry[];
  /** All conflicts of the version after the change. */
  readonly conflicts: readonly Conflict[];
}

export type GenerationStatus =
  'QUEUED' | 'RUNNING' | 'COMPLETED' | 'INFEASIBLE' | 'FAILED' | 'CANCELLED';

/** Pushed over Socket.IO on room `timetable-job:{jobId}`, event `timetable.generation`. */
export interface GenerationProgress {
  readonly jobId: string;
  readonly versionId: string;
  readonly status: GenerationStatus;
  /** 0..1 */
  readonly progress: number;
  readonly score: number | null;
  readonly hardViolations: number;
  readonly softPenalty: number;
}

/** Everything the grid needs to label entries, loaded once per screen. */
export interface TimetableLookups {
  readonly template: PeriodTemplate;
  readonly subjects: readonly Subject[];
  readonly teachers: readonly Teacher[];
  readonly rooms: readonly Room[];
  readonly sections: readonly SectionRef[];
}

export type ViewMode = 'section' | 'teacher' | 'room';
