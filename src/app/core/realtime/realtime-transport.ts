import { InjectionToken } from '@angular/core';

/** Handshake payload the backend gateway expects (`auth: { token, branchId? }`). */
export interface RealtimeAuth {
  readonly token: string | null;
  readonly branchId?: string;
}

export interface RealtimeConnectOptions {
  /** Socket.IO origin (runtime config `wsUrl`; `/` = same origin). */
  readonly url: string;
  /** Called on every (re)connect so refreshed tokens and branch switches are used. */
  readonly auth: () => RealtimeAuth;
  readonly tenant: string | null;
}

export interface RealtimeAck {
  readonly ok: boolean;
  readonly room: string;
  readonly code?: string;
}

export type TransportStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Minimal transport surface used by RealtimeService. The production implementation wraps
 * socket.io-client; mock builds provide an in-page bus that MSW handlers publish to.
 */
export interface RealtimeTransport {
  connect(options: RealtimeConnectOptions): void;
  disconnect(): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
  emitWithAck(event: string, payload: unknown): Promise<RealtimeAck>;
  onStatus(handler: (status: TransportStatus, reason?: string) => void): () => void;
}

export const REALTIME_TRANSPORT = new InjectionToken<RealtimeTransport>('REALTIME_TRANSPORT');

/** Backend gateway namespace (school-erp-backend realtime.gateway.ts). */
export const REALTIME_NAMESPACE = '/realtime';
