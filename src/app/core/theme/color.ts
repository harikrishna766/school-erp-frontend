/** Pure colour helpers used to derive an accessible palette from a school's brand colour. */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(input: string): Rgb | null {
  const match = HEX.exec(input.trim());
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = [...hex].map((c) => c + c).join('');
  }
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Linear blend: `amount` 0 → a, 1 → b. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const NEAR_BLACK: Rgb = { r: 18, g: 18, b: 24 };

/** Picks white or near-black text — whichever contrasts more with `bg`. */
export function readableOn(bg: Rgb): Rgb {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, NEAR_BLACK) ? WHITE : NEAR_BLACK;
}

/**
 * Moves `color` toward black (light theme) or white (dark theme) until it reaches
 * `target` contrast against `surface`, so brand colours stay legible as text/icons.
 */
export function ensureContrast(color: Rgb, surface: Rgb, target: number): Rgb {
  const toward = luminance(surface) > 0.5 ? BLACK : WHITE;
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20);
    if (contrastRatio(candidate, surface) >= target) {
      return candidate;
    }
  }
  return toward;
}

export interface BrandPalette {
  readonly primaryLight: string;
  readonly onPrimaryLight: string;
  readonly containerLight: string;
  readonly onContainerLight: string;
  readonly primaryDark: string;
  readonly onPrimaryDark: string;
  readonly containerDark: string;
  readonly onContainerDark: string;
}

/** Surfaces match the Material 3 neutral surfaces used in `styles.scss`. */
const LIGHT_SURFACE: Rgb = { r: 250, g: 249, b: 253 };
const DARK_SURFACE: Rgb = { r: 18, g: 19, b: 24 };

/**
 * Derives light/dark primary + container roles from one brand hex. Primary is
 * nudged to ≥ 4.5:1 against the surface (WCAG AA for text), and "on" colours are
 * picked for maximum contrast. Returns null for an invalid colour.
 */
export function derivePalette(brandHex: string): BrandPalette | null {
  const brand = parseHex(brandHex);
  if (!brand) {
    return null;
  }
  const primaryLight = ensureContrast(brand, LIGHT_SURFACE, 4.5);
  const primaryDark = ensureContrast(mix(brand, WHITE, 0.35), DARK_SURFACE, 4.5);
  const containerLight = mix(brand, WHITE, 0.82);
  const containerDark = mix(brand, DARK_SURFACE, 0.65);

  return {
    primaryLight: toHex(primaryLight),
    onPrimaryLight: toHex(readableOn(primaryLight)),
    containerLight: toHex(containerLight),
    onContainerLight: toHex(ensureContrast(brand, containerLight, 4.5)),
    primaryDark: toHex(primaryDark),
    onPrimaryDark: toHex(readableOn(primaryDark)),
    containerDark: toHex(containerDark),
    onContainerDark: toHex(ensureContrast(mix(brand, WHITE, 0.6), containerDark, 4.5)),
  };
}
