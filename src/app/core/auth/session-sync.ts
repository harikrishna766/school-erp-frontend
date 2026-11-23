import { DestroyRef, Injectable, inject } from '@angular/core';

export type SessionMessage =
  | {
      readonly type: 'token';
      readonly accessToken: string;
      readonly expiresAt: number;
      readonly sessionId: string;
    }
  | { readonly type: 'logout' };

const CHANNEL = 'erp-auth';
const REFRESH_LOCK = 'erp-auth-refresh';

/**
 * Keeps tabs of the same browser in step:
 * - a refreshed access token is shared, so other tabs don't refresh again;
 * - logout in one tab logs out all tabs;
 * - refreshes are serialized with the Web Locks API, because the backend rotates refresh
 *   tokens and treats a second use of an old token as theft (REUSE_DETECTED revokes the
 *   whole session family).
 */
@Injectable({ providedIn: 'root' })
export class SessionSync {
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  publish(message: SessionMessage): void {
    this.channel?.postMessage(message);
  }

  subscribe(handler: (message: SessionMessage) => void): void {
    this.channel?.addEventListener('message', (event: MessageEvent<SessionMessage>) =>
      handler(event.data),
    );
  }

  /** Runs `task` while holding the cross-tab refresh lock (plain call if unsupported). */
  withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = globalThis.navigator?.locks;
    return locks ? locks.request(REFRESH_LOCK, task) : task();
  }
}
