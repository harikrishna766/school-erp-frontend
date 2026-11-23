import { resolveTenantSlug } from './tenant-context';

describe('resolveTenantSlug', () => {
  it('prefers the configured slug', () => {
    expect(resolveTenantSlug('greenwood.example.com', 'demo')).toBe('demo');
  });

  it('uses the first label of a school sub-domain', () => {
    expect(resolveTenantSlug('greenwood.example.com', null)).toBe('greenwood');
    expect(resolveTenantSlug('sunrise.erp.example.co.in', null)).toBe('sunrise');
  });

  it.each(['localhost', 'example.com', 'www.example.com', 'app.example.com', '192.168.1.20'])(
    'returns null for non-tenant host %s',
    (host) => {
      expect(resolveTenantSlug(host, null)).toBeNull();
    },
  );
});
