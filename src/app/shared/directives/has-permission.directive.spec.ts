import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { checkPermissions } from '../../core/access/permission';
import { AccessStore } from '../../core/access/access.store';
import { HasPermission } from './has-permission.directive';

@Component({
  imports: [HasPermission],
  template: `
    <button type="button" *hasPermission="'fees:invoice:create'" id="create">Create</button>
    <section *hasPermission="['a:b:view', 'a:b:edit']; mode: 'all'; else denied" id="both">
      both
    </section>
    <ng-template #denied><p id="denied">read only</p></ng-template>
  `,
})
class Host {}

describe('*hasPermission', () => {
  const granted = signal<string[]>([]);
  const access = {
    can: (required: string | readonly string[], mode: 'any' | 'all' = 'any') =>
      checkPermissions(granted(), required, mode),
  };

  async function render() {
    TestBed.configureTestingModule({ providers: [{ provide: AccessStore, useValue: access }] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, q: (s: string) => el.querySelector(s) };
  }

  beforeEach(() => granted.set([]));

  it('hides content without the permission and shows the else template', async () => {
    const { q } = await render();
    expect(q('#create')).toBeNull();
    expect(q('#both')).toBeNull();
    expect(q('#denied')).not.toBeNull();
  });

  it('reacts when permissions change, honouring all-mode', async () => {
    const { fixture, q } = await render();
    granted.set(['fees:*:*', 'a:b:view']);
    await fixture.whenStable();
    expect(q('#create')).not.toBeNull();
    expect(q('#both')).toBeNull();
    expect(q('#denied')).not.toBeNull();

    granted.set(['a:b:view', 'a:b:edit']);
    await fixture.whenStable();
    expect(q('#both')).not.toBeNull();
    expect(q('#denied')).toBeNull();
  });
});
