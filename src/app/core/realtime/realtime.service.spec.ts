import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig } from '../../../testing/providers';
import { AuthStore } from '../auth/auth.store';
import { BranchContext } from '../tenant/branch-context';
import { TenantContext } from '../tenant/tenant-context';
import {
  REALTIME_TRANSPORT,
  type RealtimeAck,
  type RealtimeConnectOptions,
  type RealtimeTransport,
  type TransportStatus,
} from './realtime-transport';
import { RealtimeService, RoomRejectedError } from './realtime.service';

class FakeTransport implements RealtimeTransport {
  connects: RealtimeConnectOptions[] = [];
  disconnects = 0;
  emitted: { event: string; payload: unknown }[] = [];
  ack: RealtimeAck = { ok: true, room: '' };
  private listeners = new Map<string, Set<(p: unknown) => void>>();
  private statusListeners = new Set<(s: TransportStatus) => void>();

  connect(options: RealtimeConnectOptions): void {
    this.connects.push(options);
  }
  disconnect(): void {
    this.disconnects++;
  }
  on(event: string, handler: (p: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }
  async emitWithAck(event: string, payload: unknown): Promise<RealtimeAck> {
    this.emitted.push({ event, payload });
    return this.ack;
  }
  onStatus(handler: (s: TransportStatus) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }
  // test helpers
  serverEmit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }
  status(s: TransportStatus): void {
    this.statusListeners.forEach((h) => h(s));
  }
}

describe('RealtimeService', () => {
  let transport: FakeTransport;
  let service: RealtimeService;
  const auth = {
    isAuthenticated: signal(true),
    accessToken: signal<string | null>('at-1'),
    refresh: vi.fn(),
    endSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.set(true);
    auth.accessToken.set('at-1');
    transport = new FakeTransport();
    TestBed.configureTestingModule({
      providers: [
        provideTestConfig({ wsUrl: '/' }),
        { provide: REALTIME_TRANSPORT, useValue: transport },
        { provide: AuthStore, useValue: auth },
        { provide: BranchContext, useValue: { id: signal('b1') } },
        { provide: TenantContext, useValue: { slug: signal('demo') } },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  it('connects lazily on first use, with a handshake that reads the current token', () => {
    expect(transport.connects).toHaveLength(0);
    const sub = service.on('notification').subscribe();
    expect(transport.connects).toHaveLength(1);
    const options = transport.connects[0];
    expect(options.tenant).toBe('demo');
    expect(options.auth()).toEqual({ token: 'at-1', branchId: 'b1' });
    auth.accessToken.set('at-2');
    expect(options.auth().token).toBe('at-2'); // reconnects use the refreshed token
    sub.unsubscribe();
  });

  it('does not connect for signed-out users', () => {
    auth.isAuthenticated.set(false);
    service.on('x').subscribe();
    expect(transport.connects).toHaveLength(0);
  });

  it('ref-counts room subscriptions and re-joins rooms after a reconnect', async () => {
    const received: unknown[] = [];
    const a = service.watch('timetable:job-1', 'progress').subscribe((p) => received.push(p));
    const b = service.watch('timetable:job-1', 'progress').subscribe();
    expect(transport.emitted.filter((e) => e.event === 'subscribe')).toHaveLength(1);

    transport.serverEmit('progress', { pct: 40 });
    expect(received).toEqual([{ pct: 40 }]);

    transport.status('connected');
    expect(transport.emitted.filter((e) => e.event === 'subscribe')).toHaveLength(2);

    a.unsubscribe();
    expect(transport.emitted.some((e) => e.event === 'unsubscribe')).toBe(false);
    b.unsubscribe();
    expect(transport.emitted.at(-1)).toEqual({
      event: 'unsubscribe',
      payload: { room: 'timetable:job-1' },
    });
    expect(service.status()).toBe('connected');
  });

  it('errors the stream when the server refuses the room', async () => {
    transport.ack = { ok: false, room: 'branch:x', code: 'PERMISSION_DENIED' };
    const error = await new Promise<unknown>((resolve) =>
      service.watch('branch:x', 'e').subscribe({ error: resolve }),
    );
    expect(error).toBeInstanceOf(RoomRejectedError);
    expect((error as RoomRejectedError).code).toBe('PERMISSION_DENIED');
  });

  it('refreshes the token once and reconnects when the handshake is rejected', async () => {
    auth.refresh.mockResolvedValue('at-2');
    service.on('x').subscribe();
    transport.serverEmit('error', { code: 'TOKEN_EXPIRED' });
    transport.serverEmit('error', { code: 'TOKEN_EXPIRED' });
    await vi.waitFor(() => expect(transport.connects).toHaveLength(2));
    expect(auth.refresh).toHaveBeenCalledOnce();
  });

  it('ends the session if that refresh fails', async () => {
    auth.refresh.mockRejectedValue(new Error('nope'));
    service.on('x').subscribe();
    transport.serverEmit('error', { code: 'UNAUTHENTICATED' });
    await vi.waitFor(() => expect(auth.endSession).toHaveBeenCalledWith('expired'));
  });

  it('disconnects when the user signs out', async () => {
    service.on('x').subscribe();
    auth.isAuthenticated.set(false);
    TestBed.tick();
    expect(transport.disconnects).toBe(1);
    expect(service.status()).toBe('idle');
  });
});
