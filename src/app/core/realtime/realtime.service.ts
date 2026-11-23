import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { APP_CONFIG } from '../config/app-config';
import { BranchContext } from '../tenant/branch-context';
import { TenantContext } from '../tenant/tenant-context';
import {
  REALTIME_TRANSPORT,
  type RealtimeConnectOptions,
  type TransportStatus,
} from './realtime-transport';

export type RealtimeStatus = 'idle' | TransportStatus;

/** Thrown into a watch() stream when the server refuses a room subscription. */
export class RoomRejectedError extends Error {
  constructor(
    readonly room: string,
    readonly code: string,
  ) {
    super(`Room ${room} rejected: ${code}`);
  }
}

/** Codes the gateway uses when the handshake/token is rejected. */
const AUTH_ERRORS = new Set(['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'TOKEN_INVALID']);

/**
 * App-wide Socket.IO connection to the backend's `/realtime` gateway.
 *
 * - Connects lazily on first use, only when signed in; disconnects on logout.
 * - The handshake reads the *current* access token and branch on every (re)connect.
 * - On an auth rejection it refreshes the token once and reconnects.
 * - `watch(room, event)` joins a room (ref-counted across subscribers), re-joins after
 *   reconnects, and leaves when the last subscriber unsubscribes.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly transport = inject(REALTIME_TRANSPORT);
  private readonly auth = inject(AuthStore);
  private readonly config = inject(APP_CONFIG);
  private readonly branch = inject(BranchContext);
  private readonly tenant = inject(TenantContext);

  private readonly _status = signal<RealtimeStatus>('idle');
  readonly status = this._status.asReadonly();

  private readonly rooms = new Map<string, number>();
  private started = false;
  private authRetried = false;

  constructor() {
    const offStatus = this.transport.onStatus((status) => {
      this._status.set(status);
      if (status === 'connected') {
        this.authRetried = false;
        for (const room of this.rooms.keys()) {
          void this.transport.emitWithAck('subscribe', { room });
        }
      }
    });
    const offError = this.transport.on('error', (payload) => this.onServerError(payload));
    inject(DestroyRef).onDestroy(() => {
      offStatus();
      offError();
      this.stop();
    });

    // Never keep a socket open for a signed-out user.
    effect(() => {
      if (!this.auth.isAuthenticated() && this.started) {
        this.stop();
      }
    });
  }

  /** Streams a server event (user/org rooms are joined automatically by the server). */
  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.ensureStarted();
      return this.transport.on(event, (payload) => subscriber.next(payload as T));
    });
  }

  /** Joins `room` for as long as the stream is subscribed and emits `event` payloads. */
  watch<T>(room: string, event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.ensureStarted();
      const off = this.transport.on(event, (payload) => subscriber.next(payload as T));
      const count = this.rooms.get(room) ?? 0;
      this.rooms.set(room, count + 1);
      if (count === 0) {
        void this.transport.emitWithAck('subscribe', { room }).then((ack) => {
          if (!ack.ok) {
            subscriber.error(new RoomRejectedError(room, ack.code ?? 'REJECTED'));
          }
        });
      }
      return () => {
        off();
        const remaining = (this.rooms.get(room) ?? 1) - 1;
        if (remaining <= 0) {
          this.rooms.delete(room);
          void this.transport.emitWithAck('unsubscribe', { room });
        } else {
          this.rooms.set(room, remaining);
        }
      };
    });
  }

  private connectOptions(): RealtimeConnectOptions {
    return {
      url: this.config.wsUrl,
      tenant: this.tenant.slug(),
      auth: () => ({
        token: this.auth.accessToken(),
        ...(this.branch.id() ? { branchId: this.branch.id() as string } : {}),
      }),
    };
  }

  private ensureStarted(): void {
    if (this.started || !this.auth.isAuthenticated()) {
      return;
    }
    this.started = true;
    this.transport.connect(this.connectOptions());
  }

  private stop(): void {
    this.started = false;
    this.rooms.clear();
    this.transport.disconnect();
    this._status.set('idle');
  }

  private onServerError(payload: unknown): void {
    const code = (payload as { code?: string } | null)?.code ?? '';
    if (!AUTH_ERRORS.has(code) || this.authRetried || !this.auth.isAuthenticated()) {
      return;
    }
    this.authRetried = true;
    void this.auth.refresh().then(
      () => this.transport.connect(this.connectOptions()),
      () => this.auth.endSession('expired'),
    );
  }
}
