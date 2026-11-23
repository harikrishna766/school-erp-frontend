import type {
  PeriodTemplate,
  Room,
  SectionRef,
  Subject,
  Teacher,
  TimetableEntry,
  TimetableVersion,
  Weekday,
} from '../../app/features/timetable/data/timetable.models';
import { isTeachable } from '../../app/features/timetable/data/grid-model';

/**
 * Deterministic demo data for the timetable mocks: a CBSE-style middle/secondary school,
 * Mon–Sat with a Saturday half day, built by a simple greedy scheduler so the published
 * version is clash-free.
 */

export const TEMPLATE: PeriodTemplate = {
  id: 'tpl-std',
  name: 'Standard day',
  days: [1, 2, 3, 4, 5, 6],
  slots: [
    { index: 0, start: '08:45', end: '09:30', kind: 'TEACHING', label: 'P1' },
    { index: 1, start: '09:30', end: '10:15', kind: 'TEACHING', label: 'P2' },
    { index: 2, start: '10:15', end: '10:30', kind: 'BREAK', label: 'Break' },
    { index: 3, start: '10:30', end: '11:15', kind: 'TEACHING', label: 'P3' },
    { index: 4, start: '11:15', end: '12:00', kind: 'TEACHING', label: 'P4' },
    { index: 5, start: '12:00', end: '12:40', kind: 'LUNCH', label: 'Lunch' },
    { index: 6, start: '12:40', end: '13:25', kind: 'TEACHING', label: 'P5' },
    { index: 7, start: '13:25', end: '14:10', kind: 'TEACHING', label: 'P6' },
    { index: 8, start: '14:10', end: '14:55', kind: 'TEACHING', label: 'P7' },
  ],
  lastSlotByDay: { 6: 4 },
};

export const SUBJECTS: readonly Subject[] = [
  { id: 'sub-math', name: 'Mathematics', code: 'MATH', color: '#3f51b5' },
  { id: 'sub-eng', name: 'English', code: 'ENG', color: '#00897b' },
  { id: 'sub-sci', name: 'Science', code: 'SCI', color: '#43a047' },
  { id: 'sub-soc', name: 'Social Studies', code: 'SOC', color: '#8d6e63' },
  { id: 'sub-tel', name: 'Telugu', code: 'TEL', color: '#e65100' },
  { id: 'sub-hin', name: 'Hindi', code: 'HIN', color: '#c2185b' },
  { id: 'sub-cs', name: 'Computer Science', code: 'CS', color: '#0277bd' },
  { id: 'sub-pe', name: 'Physical Education', code: 'PE', color: '#f9a825' },
  { id: 'sub-art', name: 'Art', code: 'ART', color: '#7b1fa2' },
];

/** Weekly periods per subject for every section (39 teachable slots/week). */
const REQUIREMENTS: Readonly<Record<string, number>> = {
  'sub-math': 7,
  'sub-eng': 6,
  'sub-sci': 6,
  'sub-soc': 5,
  'sub-tel': 4,
  'sub-hin': 4,
  'sub-cs': 2,
  'sub-pe': 2,
  'sub-art': 1,
};

const NAMES = [
  ['Ravi Kumar', 'RK'],
  ['Lakshmi Devi', 'LD'],
  ['Suresh Babu', 'SB'],
  ['Anitha Rao', 'AR'],
  ['Mohammed Irfan', 'MI'],
  ['Priya Sharma', 'PS'],
  ['Venkat Reddy', 'VR'],
  ['Kavitha Nair', 'KN'],
  ['Arjun Varma', 'AV'],
  ['Sravani Goud', 'SG'],
  ['Rahul Mehta', 'RM'],
  ['Deepa Iyer', 'DI'],
  ['Kiran Patil', 'KP'],
  ['Farah Khan', 'FK'],
  ['Naresh Yadav', 'NY'],
  ['Swathi Menon', 'SM'],
  ['Gopal Krishna', 'GK'],
  ['Meena Joshi', 'MJ'],
] as const;

export const TEACHERS: readonly Teacher[] = NAMES.map(([name, shortName], i) => ({
  id: `t-${i + 1}`,
  name,
  shortName,
}));

const CLASSES = [6, 7, 8, 9, 10, 11];
export const SECTIONS: readonly SectionRef[] = CLASSES.flatMap((c) =>
  ['A', 'B'].map((s) => ({
    id: `sec-${c}${s.toLowerCase()}`,
    name: `${c}-${s}`,
    classId: `cls-${c}`,
  })),
);

export const ROOMS: readonly Room[] = [
  ...SECTIONS.map((s) => ({ id: `room-${s.id}`, name: `Room ${s.name}`, capacity: 40 })),
  { id: 'room-sci-lab', name: 'Science Lab', capacity: 30 },
  { id: 'room-cs-lab', name: 'Computer Lab', capacity: 30 },
  { id: 'room-ground', name: 'Playground', capacity: null },
  { id: 'room-art', name: 'Art Room', capacity: 30 },
];

/** Subject → teachers who can teach it (load spread across sections). */
const TEACHERS_BY_SUBJECT: Readonly<Record<string, readonly string[]>> = {
  'sub-math': ['t-1', 't-9', 't-13'],
  'sub-eng': ['t-2', 't-10', 't-14'],
  'sub-sci': ['t-3', 't-11', 't-15'],
  'sub-soc': ['t-4', 't-12'],
  'sub-tel': ['t-5', 't-16'],
  'sub-hin': ['t-6', 't-17'],
  'sub-cs': ['t-7'],
  'sub-pe': ['t-8'],
  'sub-art': ['t-18'],
};

const SPECIAL_ROOM: Readonly<Record<string, string>> = {
  'sub-cs': 'room-cs-lab',
  'sub-pe': 'room-ground',
  'sub-art': 'room-art',
};

function teachableSlots(): { day: Weekday; slotIndex: number }[] {
  return TEMPLATE.days.flatMap((day) =>
    TEMPLATE.slots
      .filter((slot) => isTeachable(slot, day, TEMPLATE.lastSlotByDay))
      .map((slot) => ({ day, slotIndex: slot.index })),
  );
}

/** Greedy placement: spreads each subject over the week, avoiding teacher/room clashes. */
function schedule(versionId: string): TimetableEntry[] {
  const slots = teachableSlots();
  const busy = new Set<string>(); // `${kind}:${id}:${day}:${slot}`
  const entries: TimetableEntry[] = [];
  let n = 0;
  SECTIONS.forEach((section, sectionIdx) => {
    for (const [subjectId, count] of Object.entries(REQUIREMENTS)) {
      const pool = TEACHERS_BY_SUBJECT[subjectId];
      const teacherId = pool[sectionIdx % pool.length];
      const roomId = SPECIAL_ROOM[subjectId] ?? `room-${section.id}`;
      let placed = 0;
      // Rotate the starting slot per section/subject so subjects spread across the week.
      const offset = (sectionIdx * 7 + subjectId.length * 3) % slots.length;
      for (let k = 0; k < slots.length && placed < count; k++) {
        const { day, slotIndex } = slots[(offset + k * 5) % slots.length];
        const keys = [
          `sec:${section.id}:${day}:${slotIndex}`,
          `tch:${teacherId}:${day}:${slotIndex}`,
          ...(SPECIAL_ROOM[subjectId] ? [`room:${roomId}:${day}:${slotIndex}`] : []),
        ];
        const sameSubjectToday = entries.filter(
          (e) => e.sectionId === section.id && e.subjectId === subjectId && e.day === day,
        ).length;
        if (keys.some((key) => busy.has(key)) || sameSubjectToday >= 2) {
          continue;
        }
        keys.forEach((key) => busy.add(key));
        entries.push({
          id: `${versionId}-e${++n}`,
          versionId,
          sectionId: section.id,
          day,
          slotIndex,
          subjectId,
          teacherId,
          roomId,
          locked: false,
        });
        placed++;
      }
    }
  });
  return entries;
}

export function initialVersions(): { versions: TimetableVersion[]; entries: TimetableEntry[] } {
  const published: TimetableVersion = {
    id: 'v-2025-t1',
    name: '2025–26 Term 1',
    status: 'PUBLISHED',
    templateId: TEMPLATE.id,
    createdAt: '2025-05-20T09:00:00.000Z',
    publishedAt: '2025-06-01T06:00:00.000Z',
    score: 912,
  };
  const draft: TimetableVersion = {
    id: 'v-2025-t1-r2',
    name: 'Term 1 – revision 2 (draft)',
    status: 'DRAFT',
    templateId: TEMPLATE.id,
    createdAt: '2025-11-10T09:00:00.000Z',
    publishedAt: null,
    score: null,
  };
  const base = schedule(published.id);
  const copy = base.map((e) => ({
    ...e,
    id: e.id.replace(published.id, draft.id),
    versionId: draft.id,
    // A couple of locked periods so the editor shows them.
    locked: e.subjectId === 'sub-pe' && e.sectionId === 'sec-6a',
  }));
  return { versions: [published, draft], entries: [...base, ...copy] };
}
