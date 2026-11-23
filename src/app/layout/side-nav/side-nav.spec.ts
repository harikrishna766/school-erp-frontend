import { TestBed } from '@angular/core/testing';
import { provideTestBasics } from '../../../testing/providers';
import { HOME_ITEM } from '../navigation/navigation.service';
import { SideNav } from './side-nav';

describe('SideNav', () => {
  async function render(collapsed: boolean) {
    TestBed.configureTestingModule({ providers: provideTestBasics() });
    const fixture = TestBed.createComponent(SideNav);
    fixture.componentRef.setInput('home', HOME_ITEM);
    fixture.componentRef.setInput('collapsed', collapsed);
    fixture.componentRef.setInput('schoolName', 'Greenwood');
    fixture.componentRef.setInput('sections', [
      {
        group: 'finance',
        labelKey: 'navGroup.finance',
        items: [{ id: 'fees', link: '/fees', labelKey: 'nav.fees', icon: 'payments' }],
      },
    ]);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows section headings and labels when expanded', async () => {
    const { el } = await render(false);
    expect(el.querySelector('h2')?.textContent).toContain('navGroup.finance');
    expect(el.querySelector('[data-testid="nav-fees"]')?.textContent).toContain('nav.fees');
    expect(el.textContent).toContain('Greenwood');
    expect(el.querySelector('[data-testid="nav-fees"]')?.getAttribute('aria-label')).toBeNull();
  });

  it('renders an icon rail with accessible names when collapsed', async () => {
    const { el } = await render(true);
    expect(el.classList.contains('collapsed')).toBe(true);
    expect(el.querySelector('h2')).toBeNull();
    expect(el.textContent).not.toContain('Greenwood');
    expect(el.querySelector('[data-testid="nav-fees"]')?.getAttribute('aria-label')).toBe(
      'nav.fees',
    );
  });

  it('emits navigated when a destination is chosen', async () => {
    const { fixture, el } = await render(false);
    const spy = vi.fn();
    fixture.componentInstance.navigated.subscribe(spy);
    el.querySelector<HTMLAnchorElement>('[data-testid="nav-fees"]')!.click();
    await fixture.whenStable();
    expect(spy).toHaveBeenCalledOnce();
  });
});
