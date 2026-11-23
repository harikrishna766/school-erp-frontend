import type { TenantBranding } from '../../app/core/tenant/branding.store';

export const MOCK_TENANTS: Readonly<Record<string, TenantBranding>> = {
  demo: {
    schoolName: 'Greenwood International School',
    shortName: 'Greenwood',
    logoUrl: '/mock-assets/greenwood-logo.svg',
    primaryColor: '#0f6e56',
  },
  sunrise: {
    schoolName: 'Sunrise Public School',
    shortName: 'Sunrise',
    logoUrl: null,
    primaryColor: '#b4461b',
  },
};
