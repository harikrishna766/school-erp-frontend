/**
 * Same semantics as the backend's `matchesPermission`: three `:`-separated segments,
 * any of which may be `*` in the pattern. `fees:*:*` matches `fees:invoice:view`.
 */
export function matchesPermission(pattern: string, key: string): boolean {
  const p = pattern.split(':');
  const k = key.split(':');
  return p.length === 3 && k.length === 3 && p.every((seg, i) => seg === '*' || seg === k[i]);
}

/** True if any granted pattern covers `required`. Required keys never contain `*`. */
export function isGranted(granted: Iterable<string>, required: string): boolean {
  for (const pattern of granted) {
    if (pattern === required || matchesPermission(pattern, required)) {
      return true;
    }
  }
  return false;
}

export type PermissionMode = 'any' | 'all';

/** `required` may be a single key or a list combined with `mode` (default: any). */
export function checkPermissions(
  granted: Iterable<string>,
  required: string | readonly string[],
  mode: PermissionMode = 'any',
): boolean {
  const list = typeof required === 'string' ? [required] : required;
  if (list.length === 0) {
    return true;
  }
  const grantedList = [...granted];
  return mode === 'all'
    ? list.every((r) => isGranted(grantedList, r))
    : list.some((r) => isGranted(grantedList, r));
}
