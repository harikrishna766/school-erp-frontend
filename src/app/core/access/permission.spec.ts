import { checkPermissions, isGranted, matchesPermission } from './permission';

describe('permission matching (same semantics as the backend)', () => {
  it.each([
    ['fees:invoice:view', 'fees:invoice:view', true],
    ['fees:*:*', 'fees:invoice:view', true],
    ['*:*:view', 'students:student:view', true],
    ['*:*:*', 'core:org:update', true],
    ['fees:*:*', 'exam:marks:view', false],
    ['fees:invoice:view', 'fees:invoice:create', false],
    ['fees:invoice', 'fees:invoice:view', false],
    ['fees:invoice:view:extra', 'fees:invoice:view', false],
  ])('%s vs %s → %s', (pattern, key, expected) => {
    expect(matchesPermission(pattern, key)).toBe(expected);
  });

  it('isGranted checks any granted pattern', () => {
    expect(isGranted(['exam:*:*', 'fees:invoice:view'], 'exam:marks:enter')).toBe(true);
    expect(isGranted([], 'exam:marks:enter')).toBe(false);
  });

  it('checkPermissions supports any/all and treats an empty list as allowed', () => {
    const granted = ['a:b:view', 'a:b:edit'];
    expect(checkPermissions(granted, ['a:b:view', 'x:y:z'])).toBe(true);
    expect(checkPermissions(granted, ['a:b:view', 'x:y:z'], 'all')).toBe(false);
    expect(checkPermissions(granted, ['a:b:view', 'a:b:edit'], 'all')).toBe(true);
    expect(checkPermissions(granted, [])).toBe(true);
    expect(checkPermissions(granted, 'a:b:delete')).toBe(false);
  });
});
