import { TestBed } from '@angular/core/testing';
import { PREF_KEYS } from '../storage/local-storage';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    root = document.documentElement;
    root.className = '';
    root.removeAttribute('data-branded');
  });

  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  it('defaults to system mode', () => {
    expect(create().mode()).toBe('system');
  });

  it('toggles dark mode on <html> and persists the choice', () => {
    const theme = create();
    theme.setMode('dark');
    TestBed.tick();
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(PREF_KEYS.theme)).toBe('dark');

    theme.toggle();
    TestBed.tick();
    expect(theme.mode()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('restores a stored preference and ignores garbage', () => {
    localStorage.setItem(PREF_KEYS.theme, 'dark');
    expect(create().mode()).toBe('dark');
    TestBed.resetTestingModule();
    localStorage.setItem(PREF_KEYS.theme, 'purple');
    expect(create().mode()).toBe('system');
  });

  it('applies a valid brand colour as CSS variables', () => {
    create().applyBrandColor('#0f6e56');
    expect(root.hasAttribute('data-branded')).toBe(true);
    expect(root.style.getPropertyValue('--brand-primary-light')).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.style.getPropertyValue('--brand-on-primary-dark')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('falls back to the default palette for an invalid brand colour', () => {
    const theme = create();
    theme.applyBrandColor('#0f6e56');
    theme.applyBrandColor('chartreuse-ish');
    expect(root.hasAttribute('data-branded')).toBe(false);
    theme.applyBrandColor(null);
    expect(root.hasAttribute('data-branded')).toBe(false);
  });
});
