import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuthStore } from '../../core/auth/auth.store';
import { MODULE_REGISTRY } from '../../core/modules/module-def';
import { PREF_KEYS } from '../../core/storage/local-storage';
import { fakeBreakpoints, provideTestBasics, provideTestConfig } from '../../../testing/providers';
import { Shell } from './shell';

describe('Shell', () => {
  const logout = vi.fn().mockResolvedValue(undefined);

  async function render(device: 'phone' | 'tablet' | 'desktop') {
    const bp = fakeBreakpoints(device);
    TestBed.configureTestingModule({
      providers: [
        ...provideTestBasics(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestConfig(),
        { provide: MODULE_REGISTRY, useValue: [] },
        { provide: AuthStore, useValue: { logout } },
        bp.provider,
      ],
    });
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`);
    return { fixture, el, q, bp };
  }

  beforeEach(() => localStorage.clear());

  it('phone: bottom bar + menu button, drawer toggled by "More"', async () => {
    const { fixture, q } = await render('phone');
    expect(q('bottom-nav')).not.toBeNull();
    expect(q('nav-toggle')?.getAttribute('aria-expanded')).toBe('false');

    (q('bottom-more') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(q('nav-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(q('bottom-more')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('tablet: collapsed rail by default, toggle expands and persists', async () => {
    const { fixture, el, q } = await render('tablet');
    expect(q('bottom-nav')).toBeNull();
    expect(el.querySelector('app-side-nav')?.classList.contains('collapsed')).toBe(true);

    (q('nav-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('app-side-nav')?.classList.contains('collapsed')).toBe(false);
    expect(localStorage.getItem(PREF_KEYS.navCollapsed)).toBe('false');
  });

  it('desktop: full nav, no menu button, no bottom bar', async () => {
    const { el, q } = await render('desktop');
    expect(q('nav-toggle')).toBeNull();
    expect(q('bottom-nav')).toBeNull();
    expect(el.querySelector('app-side-nav')?.classList.contains('collapsed')).toBe(false);
  });

  it('closes the phone drawer when the layout grows past phone width', async () => {
    const { fixture, q, bp } = await render('phone');
    (q('bottom-more') as HTMLButtonElement).click();
    await fixture.whenStable();
    bp.device.set('desktop');
    await fixture.whenStable();
    bp.device.set('phone');
    await fixture.whenStable();
    expect(q('nav-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('skip link focuses <main> without navigating', async () => {
    const { el } = await render('desktop');
    const link = el.querySelector<HTMLAnchorElement>('.skip-link')!;
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('main-content');
  });
});
