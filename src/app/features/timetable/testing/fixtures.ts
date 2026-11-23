import type { TimetableEntry, TimetableLookups, TimetableVersion } from '../data/timetable.models';

/** Small, hand-checkable timetable for unit tests: 2 days × (P1, Break, P2), 2 sections. */
export const LOOKUPS: TimetableLookups = {
  template: {
    id: 'tpl',
    name: 'Test',
    days: [1, 2],
    slots: [
      { index: 0, start: '09:00', end: '09:45', kind: 'TEACHING', label: 'P1' },
      { index: 1, start: '09:45', end: '10:00', kind: 'BREAK', label: 'Break' },
      { index: 2, start: '10:00', end: '10:45', kind: 'TEACHING', label: 'P2' },
    ],
    lastSlotByDay: { 2: 0 },
  },
  subjects: [
    { id: 'math', name: 'Mathematics', code: 'MATH', color: '#3f51b5' },
    { id: 'eng', name: 'English', code: 'ENG', color: '#00897b' },
  ],
  teachers: [
    { id: 't1', name: 'Ravi Kumar', shortName: 'RK' },
    { id: 't2', name: 'Lakshmi Devi', shortName: 'LD' },
  ],
  rooms: [{ id: 'r1', name: 'Room 1', capacity: 40 }],
  sections: [
    { id: 's1', name: '7-A', classId: 'c7' },
    { id: 's2', name: '7-B', classId: 'c7' },
  ],
};

export const DRAFT: TimetableVersion = {
  id: 'v-draft',
  name: 'Draft',
  status: 'DRAFT',
  templateId: 'tpl',
  createdAt: '2025-01-01T00:00:00Z',
  publishedAt: null,
  score: null,
};

export const PUBLISHED: TimetableVersion = {
  ...DRAFT,
  id: 'v-pub',
  name: 'Published',
  status: 'PUBLISHED',
  publishedAt: '2025-01-02T00:00:00Z',
};

export const entry = (
  over: Partial<TimetableEntry> & Pick<TimetableEntry, 'id'>,
): TimetableEntry => ({
  versionId: DRAFT.id,
  sectionId: 's1',
  day: 1,
  slotIndex: 0,
  subjectId: 'math',
  teacherId: 't1',
  roomId: 'r1',
  locked: false,
  ...over,
});

export const ENTRIES: readonly TimetableEntry[] = [
  entry({ id: 'e1' }),
  entry({ id: 'e2', slotIndex: 2, subjectId: 'eng', teacherId: 't2' }),
  entry({ id: 'e3', sectionId: 's2', subjectId: 'eng', teacherId: 't2' }),
  entry({ id: 'e4', day: 2, locked: true }),
];
