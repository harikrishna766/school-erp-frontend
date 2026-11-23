import { Injectable } from '@angular/core';
import type {
  RealtimeAck,
  RealtimeConnectOptions,
  RealtimeTransport,
  TransportStatus,
} from '../app/core/realtime/realtime-transport';
import { verifyAccessToken } from './auth/session-store';

/**
 * In-page stand-in for the backend's Socket.IO gateway. MSW handlers publish events with
 * `mockRealtime.publish(room, event, payload)`; connected mock transports deliver them to
 * subscribers of that room, mirroring the gateway's rules:
 * - the handshake token must be valid, else `error { code }` + disconnect,
 * - `user:{id}` and `session:{id}` are joined automatically on connect,
 * - other rooms need `subscribe` (always allowed here; the real gateway authorizes).
 */
class MockRealtimeBus {
  private readonly clients = new Set<MockRealtimeTransport>();

  register(client: MockRealtimeTransport): void {
    this.clients.add(client);
  }

  unregister(client: MockRealtimeTransport): void {
    this.clients.delete(client);
  }

  publish(room: string, event: string, payload: unknown): void {
    for (const client of this.clients) {
      client.deliver(room, event, payload);
    }
  }
}

export const mockRealtime = new MockRealtimeBus();

@Injectable()
export class MockRealtimeTransport implements RealtimeTransport {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private readonly statusListeners = new Set<(s: TransportStatus, reason?: string) => void>();
  private readonly rooms = new Set<string>();
  private connected = false;

  connect(options: RealtimeConnectOptions): void {
    this.setStatus('connecting');
    queueMicrotask(() => {
      const { token } = options.auth();
      const identity = verifyAccessToken(token ? `Bearer ${token}` : null);
      if (!identity) {
        this.dispatch('error', { code: 'UNAUTHENTICATED', message: 'Authentication failed' });
        this.setStatus('disconnected', 'auth');
        return;
      }
      this.rooms.clear();
      this.rooms.add(`user:${identity.userId}`).add(`session:${identity.sessionId}`);
      this.connected = true;
      mockRealtime.register(this);
      this.setStatus('connected');
      this.dispatch('ready', { userId: identity.userId, rooms: [...this.rooms] });
    });
  }

  disconnect(): void {
    this.connected = false;
    this.rooms.clear();
    mockRealtime.unregister(this);
    this.setStatus('disconnected', 'client');
  }

  on(event: string, handler: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  async emitWithAck(event: string, payload: unknown): Promise<RealtimeAck> {
    const room = (payload as { room?: string } | null)?.room ?? '';
    if (!this.connected) {
      return { ok: false, room, code: 'NOT_CONNECTED' };
    }
    if (event === 'subscribe') {
      this.rooms.add(room);
    } else if (event === 'unsubscribe') {
      this.rooms.delete(room);
    }
    return { ok: true, room };
  }

  onStatus(handler: (s: TransportStatus, reason?: string) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  deliver(room: string, event: string, payload: unknown): void {
    if (this.connected && this.rooms.has(room)) {
      this.dispatch(event, payload);
    }
  }

  private dispatch(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }

  private setStatus(status: TransportStatus, reason?: string): void {
    this.statusListeners.forEach((handler) => handler(status, reason));
  }
}
