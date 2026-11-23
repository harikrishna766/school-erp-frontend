import { Injectable } from '@angular/core';
import type { Socket } from 'socket.io-client';
import {
  REALTIME_NAMESPACE,
  type RealtimeAck,
  type RealtimeConnectOptions,
  type RealtimeTransport,
  type TransportStatus,
} from './realtime-transport';

const ACK_TIMEOUT_MS = 10_000;

/**
 * socket.io-client transport. The library is imported on first connect so it never
 * weighs on the initial bundle (most screens don't need realtime).
 */
@Injectable()
export class SocketIoTransport implements RealtimeTransport {
  private socket: Socket | null = null;
  private connecting: Promise<Socket> | null = null;
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  private readonly statusListeners = new Set<(s: TransportStatus, reason?: string) => void>();

  connect(options: RealtimeConnectOptions): void {
    if (this.socket || this.connecting) {
      this.socket?.connect();
      return;
    }
    this.emitStatus('connecting');
    this.connecting = import('socket.io-client').then(({ io }) => {
      const base = options.url === '/' ? '' : options.url.replace(/\/+$/, '');
      const socket = io(`${base}${REALTIME_NAMESPACE}`, {
        // Function form: evaluated on every (re)connect attempt.
        auth: (cb) => cb({ ...options.auth() }),
        // x-tenant is only sent on the HTTP long-polling handshake (browsers can't set
        // WebSocket headers); the backend treats it as optional.
        extraHeaders: options.tenant ? { 'x-tenant': options.tenant } : undefined,
        transports: ['websocket', 'polling'],
        reconnectionDelayMax: 10_000,
      });
      socket.on('connect', () => this.emitStatus('connected'));
      socket.on('disconnect', (reason) => this.emitStatus('disconnected', reason));
      socket.on('connect_error', (err) => this.emitStatus('disconnected', err.message));
      socket.onAny((event: string, payload: unknown) => {
        this.listeners.get(event)?.forEach((handler) => handler(payload));
      });
      this.socket = socket;
      return socket;
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connecting = null;
    this.emitStatus('disconnected', 'client');
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
    const socket = this.socket ?? (await this.connecting);
    if (!socket) {
      return { ok: false, room: '', code: 'NOT_CONNECTED' };
    }
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as RealtimeAck;
  }

  onStatus(handler: (s: TransportStatus, reason?: string) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  private emitStatus(status: TransportStatus, reason?: string): void {
    this.statusListeners.forEach((handler) => handler(status, reason));
  }
}
