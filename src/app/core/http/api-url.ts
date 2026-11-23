/**
 * True for requests to our API (relative `/api/v1/...` or absolute same base). Tokens and
 * tenant headers must never leak to third parties (fonts, CDNs, payment gateways).
 */
export function isApiUrl(url: string, apiBaseUrl: string): boolean {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
}
