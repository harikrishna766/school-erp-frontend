import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { meAccess } from '../../../testing/access';
import { provideTestConfig } from '../../../testing/providers';
import { AccessStore } from './access.store';

describe('AccessStore', () => {
  let store: AccessStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTestConfig()],
    });
    store = TestBed.inject(AccessStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function load(payload = meAccess()): Promise<void> {
    const done = store.ensureLoaded();
    http.expectOne('/api/v1/me/access').flush({ success: true, data: payload });
    await done;
  }

  it('shares one request between concurrent callers', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    http.expectOne('/api/v1/me/access').flush({ success: true, data: meAccess() });
    await Promise.all([a, b]);
    expect(store.status()).toBe('loaded');
    await store.ensureLoaded(); // cached: no request
  });

  it('answers module, permission, scope and flag questions', async () => {
    await load();
    expect(store.hasModule('students')).toBe(true);
    expect(store.hasModule('fees')).toBe(false);
    expect(store.can('students:student:view')).toBe(true);
    expect(store.can(['students:student:view', 'fees:invoice:view'], 'all')).toBe(false);
    expect(store.scopeOf('attendance:student:mark')).toBe('SECTION');
    expect(store.scopeOf('fees:invoice:view')).toBeNull();
    expect(store.flag('offlineAttendance')).toBe(true);
    expect(store.flag('unknown')).toBe(false);
  });

  it('honours wildcard grants', async () => {
    await load(
      meAccess({ permissions: [{ key: 'fees:*:*', scope: 'BRANCH' }], modules: ['fees'] }),
    );
    expect(store.can('fees:invoice:create')).toBe(true);
  });

  it('canUse requires both the licence and an entry permission', async () => {
    await load(
      meAccess({
        modules: ['students'],
        permissions: [{ key: 'fees:invoice:view', scope: 'ALL' }],
      }),
    );
    expect(store.canUse({ id: 'students', viewPermissions: ['students:student:view'] })).toBe(
      false,
    );
    expect(store.canUse({ id: 'fees', viewPermissions: ['fees:invoice:view'] })).toBe(false);
  });

  it('rejects and records the error when loading fails, and can retry', async () => {
    const failing = store.ensureLoaded();
    http.expectOne('/api/v1/me/access').flush(null, { status: 500, statusText: 'Boom' });
    await expect(failing).rejects.toBeTruthy();
    expect(store.status()).toBe('error');
    await load();
    expect(store.status()).toBe('loaded');
  });

  it('clear() forgets everything', async () => {
    await load();
    store.clear();
    expect(store.user()).toBeNull();
    expect(store.can('students:student:view')).toBe(false);
    expect(store.status()).toBe('idle');
  });
});
