import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { meAccess, perm } from '../../../testing/access';
import { BranchContext } from '../tenant/branch-context';
import { AccessStore } from './access.store';

// The generated MeService uses basePath 'http://localhost' by default in tests.
const URL = 'http://localhost/api/v1/me/access';

describe('AccessStore', () => {
  let store: AccessStore;
  let http: HttpTestingController;
  let branch: BranchContext;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AccessStore);
    http = TestBed.inject(HttpTestingController);
    branch = TestBed.inject(BranchContext);
  });

  afterEach(() => http.verify());

  async function load(payload = meAccess()): Promise<void> {
    const done = store.ensureLoaded();
    http.expectOne(URL).flush(payload);
    await done;
  }

  it('shares one request between concurrent callers and caches the result', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    http.expectOne(URL).flush(meAccess());
    await Promise.all([a, b]);
    expect(store.status()).toBe('loaded');
    await store.ensureLoaded();
  });

  it('answers module, permission and scope questions', async () => {
    await load(
      meAccess({
        permissions: [
          'students:student:view',
          {
            key: 'attendance:student:mark',
            scopes: ['SECTION', 'CLASS'] as never,
            orgWide: false,
            branchIds: [],
          },
        ],
      }),
    );
    expect(store.hasModule('students')).toBe(true);
    expect(store.hasModule('fees')).toBe(false);
    expect(store.can('students:student:view')).toBe(true);
    expect(store.can(['students:student:view', 'fees:invoice:view'], 'all')).toBe(false);
    expect(store.scopesOf('attendance:student:mark')).toEqual(['SECTION', 'CLASS']);
    expect(store.scopesOf('fees:invoice:view')).toEqual([]);
    expect(store.relations()?.sectionIds).toEqual(['sec1']);
  });

  it('honours wildcard grants', async () => {
    await load(meAccess({ modules: ['fees'], permissions: ['fees:*:*'] }));
    expect(store.can('fees:invoice:create')).toBe(true);
  });

  it('canUse requires both the licence and an entry permission', async () => {
    await load(
      meAccess({ modules: ['students'], permissions: [perm('fees:invoice:view', 'ALL' as never)] }),
    );
    expect(store.canUse({ id: 'students', viewPermissions: ['students:student:view'] })).toBe(
      false,
    );
    expect(store.canUse({ id: 'fees', viewPermissions: ['fees:invoice:view'] })).toBe(false);
  });

  it('exposes the mandatory 2FA enrolment flag', async () => {
    await load(meAccess({ twoFactorSetupRequired: true }));
    expect(store.twoFactorSetupRequired()).toBe(true);
  });

  it('adopts the server branch, keeps a still-valid chosen one, and switches on request', async () => {
    await load(meAccess({ activeBranchId: 'b1' }));
    expect(branch.id()).toBe('b1');

    const branches = [
      { id: 'b1', code: 'MAIN', name: 'Main' },
      { id: 'b2', code: 'NORTH', name: 'North' },
    ];
    const switching = store.switchBranch('b2');
    const req = http.expectOne(URL);
    req.flush(meAccess({ branches, activeBranchId: 'b2' }));
    await switching;
    expect(branch.id()).toBe('b2');
  });

  it('rejects and records the error when loading fails, and can retry', async () => {
    const failing = store.ensureLoaded();
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Boom' });
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
