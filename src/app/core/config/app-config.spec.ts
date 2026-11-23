import { DEFAULT_APP_CONFIG, loadAppConfig, parseAppConfig } from './app-config';

describe('parseAppConfig', () => {
  it('accepts a complete config and trims trailing slashes from the API URL', () => {
    expect(
      parseAppConfig({
        apiBaseUrl: 'https://api.example.com/api/v1/',
        wsUrl: 'wss://api.example.com',
        defaultLanguage: 'te',
        tenantSlug: 'greenwood',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.com/api/v1',
      wsUrl: 'wss://api.example.com',
      defaultLanguage: 'te',
      tenantSlug: 'greenwood',
    });
  });

  it('falls back per field for missing, empty or wrongly-typed values', () => {
    expect(parseAppConfig({ apiBaseUrl: '', wsUrl: 42, defaultLanguage: 'fr' })).toEqual(
      DEFAULT_APP_CONFIG,
    );
  });

  it('tolerates non-object payloads', () => {
    expect(parseAppConfig(null)).toEqual(DEFAULT_APP_CONFIG);
    expect(parseAppConfig('oops')).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe('loadAppConfig', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns defaults when the file cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(loadAppConfig('/config/app-config.json')).resolves.toEqual(DEFAULT_APP_CONFIG);
  });

  it('parses the fetched JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ tenantSlug: 'demo' }), { status: 200 }),
    );
    await expect(loadAppConfig('/x.json')).resolves.toMatchObject({ tenantSlug: 'demo' });
  });
});
