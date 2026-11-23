import { TestBed } from '@angular/core/testing';
import { LANGUAGES } from '../../core/i18n/languages';
import { provideTestBasics } from '../../../testing/providers';
import { Header } from './header';

describe('Header', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: provideTestBasics() });
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.componentRef.setInput('currentLanguage', 'en');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('hides the menu button when asked (desktop)', async () => {
    const { el } = await render({ showMenuButton: false });
    expect(el.querySelector('[data-testid="nav-toggle"]')).toBeNull();
  });

  it('reflects nav state in aria-expanded and emits menuToggle', async () => {
    const { fixture, el } = await render({ navExpanded: true });
    const toggle = el.querySelector<HTMLButtonElement>('[data-testid="nav-toggle"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const spy = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(spy);
    toggle.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('labels the theme toggle by the action it performs', async () => {
    const { fixture, el } = await render({ isDark: false });
    const btn = () => el.querySelector('[data-testid="theme-toggle"]')!;
    expect(btn().getAttribute('aria-label')).toBe('shell.darkMode');
    fixture.componentRef.setInput('isDark', true);
    await fixture.whenStable();
    expect(btn().getAttribute('aria-label')).toBe('shell.lightMode');
  });

  it('shows the school name only when showBrand is set', async () => {
    const { fixture, el } = await render({ schoolName: 'Greenwood' });
    expect(el.textContent).not.toContain('Greenwood');
    fixture.componentRef.setInput('showBrand', true);
    await fixture.whenStable();
    expect(el.textContent).toContain('Greenwood');
  });
});
