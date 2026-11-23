export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'te', label: 'తెలుగు', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
] as const satisfies readonly { code: string; label: string; dir: 'ltr' | 'rtl' }[];

export type Language = (typeof LANGUAGES)[number]['code'];
export type LanguageDef = (typeof LANGUAGES)[number];

export function isLanguage(value: string): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}
