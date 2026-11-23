import type { Weekday } from '../data/timetable.models';

/** UI language → BCP-47 locale (Indian conventions for all three). */
const LOCALES: Readonly<Record<string, string>> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

export function localeFor(lang: string): string {
  return LOCALES[lang] ?? 'en-IN';
}

const timeFormats = new Map<string, Intl.DateTimeFormat>();

/** 'HH:mm' → locale time, e.g. '09:40' → '9:40 am' (en) / 'ఉ 9:40' (te). */
export function formatSlotTime(hhmm: string, lang: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const locale = localeFor(lang);
  let fmt = timeFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
    timeFormats.set(locale, fmt);
  }
  return fmt.format(new Date(2024, 0, 1, h, m));
}

/** ISO weekday → locale name. 2024-01-01 was a Monday. */
export function weekdayName(day: Weekday, lang: string, width: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: width }).format(
    new Date(2024, 0, day),
  );
}

/** Minutes since midnight for 'HH:mm'. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
