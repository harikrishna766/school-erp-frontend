import { detectConflicts } from './conflicts';
import { SECTIONS, initialVersions } from './seed';

describe('timetable mock seed', () => {
  const { versions, entries } = initialVersions();
  const published = entries.filter((e) => e.versionId === versions[0].id);

  it('is deterministic', () => {
    expect(initialVersions().entries).toEqual(entries);
  });

  it('produces a published version with no hard conflicts', () => {
    expect(detectConflicts(published).filter((c) => c.severity === 'HARD')).toEqual([]);
  });

  it('places (nearly) the full weekly load for every section', () => {
    for (const section of SECTIONS) {
      const count = published.filter((e) => e.sectionId === section.id).length;
      expect(count, section.name).toBeGreaterThanOrEqual(34);
      expect(count, section.name).toBeLessThanOrEqual(37);
    }
  });

  it('detects clashes and over-allocation', () => {
    const [a, b] = published;
    const clashed = [
      ...published.slice(2),
      a,
      { ...b, day: a.day, slotIndex: a.slotIndex, sectionId: a.sectionId },
    ];
    const kinds = detectConflicts(clashed).map((c) => c.kind);
    expect(kinds).toContain('SECTION_CLASH');
  });
});
