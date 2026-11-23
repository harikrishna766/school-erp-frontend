import { contrastRatio, derivePalette, ensureContrast, parseHex, readableOn, toHex } from './color';

describe('color', () => {
  it('parses 3- and 6-digit hex with or without #', () => {
    expect(parseHex('#0f6e56')).toEqual({ r: 15, g: 110, b: 86 });
    expect(parseHex('fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex(' #ABC ')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('rejects invalid colours', () => {
    for (const bad of ['', '#12', '#12345', 'red', '#ggg', 'rgb(0,0,0)']) {
      expect(parseHex(bad)).toBeNull();
    }
  });

  it('round-trips hex', () => {
    expect(toHex(parseHex('#0f6e56')!)).toBe('#0f6e56');
  });

  it('computes WCAG contrast ratios', () => {
    const black = parseHex('#000')!;
    const white = parseHex('#fff')!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('picks readable text colour for light and dark backgrounds', () => {
    expect(toHex(readableOn(parseHex('#ffeb3b')!))).not.toBe('#ffffff');
    expect(toHex(readableOn(parseHex('#0d47a1')!))).toBe('#ffffff');
  });

  it('darkens a too-light colour until it meets the target contrast', () => {
    const surface = parseHex('#ffffff')!;
    const fixed = ensureContrast(parseHex('#ffe066')!, surface, 4.5);
    expect(contrastRatio(fixed, surface)).toBeGreaterThanOrEqual(4.5);
  });

  describe('derivePalette', () => {
    it('returns null for invalid input', () => {
      expect(derivePalette('not-a-colour')).toBeNull();
    });

    // Brand colours schools actually pick: pastel, neon, near-black, mid-tones.
    it.each(['#0f6e56', '#ffeb3b', '#00e5ff', '#111111', '#e91e63', '#7e57c2', '#ff9800'])(
      'keeps every role pair at WCAG AA (4.5:1) for %s',
      (brand) => {
        const p = derivePalette(brand)!;
        const pairs: [string, string][] = [
          [p.primaryLight, p.onPrimaryLight],
          [p.primaryDark, p.onPrimaryDark],
          [p.containerLight, p.onContainerLight],
          [p.containerDark, p.onContainerDark],
          [p.primaryLight, '#faf9fd'],
          [p.primaryDark, '#121318'],
        ];
        for (const [a, b] of pairs) {
          expect(contrastRatio(parseHex(a)!, parseHex(b)!)).toBeGreaterThanOrEqual(4.5);
        }
      },
    );
  });
});
