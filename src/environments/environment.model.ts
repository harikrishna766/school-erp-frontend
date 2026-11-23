/**
 * Build-time switches only. Anything that differs between deployments (API base URL,
 * websocket URL, default tenant) is runtime config — see `core/config/app-config.ts` —
 * so one Docker image can be promoted through every environment.
 */
export interface Environment {
  readonly production: boolean;
  /** Start the MSW worker before bootstrap so the UI runs without a backend. */
  readonly mockApi: boolean;
  readonly configUrl: string;
}
