import { TestBed } from '@angular/core/testing';
import { provideTestBasics } from '../../../testing/providers';
import { BottomNav } from './bottom-nav';

describe('BottomNav', () => {
  it('renders one link per item plus a "More" button that emits', async () => {
    TestBed.configureTestingModule({ providers: provideTestBasics() });
    const fixture = TestBed.createComponent(BottomNav);
    fixture.componentRef.setInput('items', [
      { id: 'dashboard', link: '/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
      { id: 'fees', link: '/fees', labelKey: 'nav.fees', icon: 'payments' },
    ]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[1].getAttribute('href')).toBe('/fees');
    expect(links[1].textContent).toContain('nav.fees');

    const more = vi.fn();
    fixture.componentInstance.more.subscribe(more);
    el.querySelector<HTMLButtonElement>('[data-testid="bottom-more"]')!.click();
    expect(more).toHaveBeenCalledOnce();
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('shell.quickNav');
  });
});
