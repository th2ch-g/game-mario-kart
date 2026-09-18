import Peer, { type DataConnection } from 'peerjs';
import { cleanInput } from '../game/engine';
import type { Input, RaceConfig, RacerSpec, RaceState } from '../game/types';

export interface Member extends RacerSpec {
  ready: boolean;
  connected: boolean;
}
export interface ConnectionSettings {
  turnUrl: string;
  turnUser: string;
  turnPassword: string;
  server: string;
  port: string;
  path: string;
  secure: boolean;
}
export const DEFAULT_CONNECTION: ConnectionSettings = {
  turnUrl: '',
  turnUser: '',
  turnPassword: '',
  server: '',
  port: '443',
  path: '/',
  secure: true,
};
export interface RoomView {
  code: string;
  host: boolean;
  status: 'connecting' | 'lobby' | 'racing' | 'error';
  members: Member[];
  message: string;
  latency: number;
  paused: boolean;
  config: RaceConfig;
}
interface RoomCallbacks {
  change: (view: RoomView) => void;
  race: (state: RaceState) => void;
  input: (id: string, input: Input) => void;
  start: (config: RaceConfig, specs: RacerSpec[]) => void;
  lobby: () => void;
}
const VERSION = 1,
  PREFIX = 'kartline-v1-',
  SESSION = 'kartline.room.v1';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n % alphabet.length],
  ).join('');
}
export function cleanCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}
export function roomLink(code: string) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.href;
}
export function readRoomSession(): {
  code: string;
  host: boolean;
  id: string;
  token: string;
} | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
    return v &&
      /^[A-Z0-9]{6}$/.test(v.code) &&
      typeof v.host === 'boolean' &&
      typeof v.id === 'string' &&
      typeof v.token === 'string'
      ? v
      : null;
  } catch {
    return null;
  }
}
function isSnapshot(value: unknown): value is RaceState {
  if (!value || typeof value !== 'object') return false;
  const v = value as RaceState;
  return (
    !!v.config &&
    [0, 1, 2].includes(v.config.track) &&
    [1, 2, 3, 4, 5].includes(v.config.laps) &&
    ['countdown', 'racing', 'finished'].includes(v.phase) &&
    Number.isFinite(v.time) &&
    Array.isArray(v.hazards) &&
    v.hazards.length <= 48 &&
    v.hazards.every(
      (h) =>
        h &&
        Number.isFinite(h.s) &&
        Number.isFinite(h.offset) &&
        ['rocket', 'mine'].includes(h.kind),
    ) &&
    Array.isArray(v.events) &&
    v.events.length <= 16 &&
    Array.isArray(v.racers) &&
    v.racers.length > 0 &&
    v.racers.length <= 8 &&
    v.racers.every(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        typeof r.name === 'string' &&
        Number.isInteger(r.kart) &&
        r.kart >= 0 &&
        r.kart < 6 &&
        [
          's',
          'offset',
          'yaw',
          'speed',
          'rank',
          'lap',
          'boost',
          'shield',
          'spin',
          'driftCharge',
        ].every((k) => Number.isFinite(r[k as keyof typeof r])) &&
        Array.isArray(r.laps),
    )
  );
}
function validConfig(v: unknown): v is RaceConfig {
  if (!v || typeof v !== 'object') return false;
  const c = v as RaceConfig;
  return (
    [0, 1, 2].includes(c.track) &&
    [1, 2, 3, 4, 5].includes(c.laps) &&
    [0, 1, 2].includes(c.difficulty) &&
    c.mode === 'online' &&
    typeof c.assist === 'boolean' &&
    Number.isInteger(c.seed)
  );
}
export class NetworkRoom {
  view: RoomView;
  id: string;
  private token: string;
  private peer: Peer;
  private links = new Map<string, DataConnection>();
  private memberTokens = new Map<string, string>();
  private linkMembers = new Map<DataConnection, string>();
  private lastInput = new Map<
    string,
    { seq: number; time: number; count: number }
  >();
  private latest: RaceState | null = null;
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private joinAttempts = 0;
  private lastSeen = Date.now();
  private inputSeq = 0;
  private reconnecting = false;
  constructor(
    host: boolean,
    code: string,
    name: string,
    kart: number,
    config: RaceConfig,
    connection: ConnectionSettings,
    private callbacks: RoomCallbacks,
    restore = false,
  ) {
    const previous = restore ? readRoomSession() : null;
    this.id = previous?.id ?? crypto.randomUUID();
    this.token = previous?.token ?? crypto.randomUUID();
    this.view = {
      code,
      host,
      status: 'connecting',
      members: [],
      message: 'ルームに接続しています…',
      latency: 0,
      paused: false,
      config: { ...config, mode: 'online' },
    };
    const own: Member = {
      id: this.id,
      name: name.trim().slice(0, 16) || 'Player',
      kart,
      cpu: false,
      ready: host,
      connected: true,
    };
    if (host) {
      this.view.members = [own];
      this.memberTokens.set(this.id, this.token);
    }
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    if (connection.turnUrl)
      iceServers.push({
        urls: connection.turnUrl,
        username: connection.turnUser,
        credential: connection.turnPassword,
      });
    const options = {
      debug: 0 as const,
      config: { iceServers },
      ...(connection.server
        ? {
            host: connection.server,
            port: Number(connection.port) || 443,
            path: connection.path || '/',
            secure: connection.secure,
          }
        : {}),
    };
    this.peer = host ? new Peer(PREFIX + code, options) : new Peer(options);
    this.peer.on('open', () => {
      if (this.disposed) return;
      if (host) {
        this.view.status = 'lobby';
        this.view.message = '友だちを招待して、レースを始めよう。';
        this.emit();
      } else this.connectHost(own);
      try {
        sessionStorage.setItem(
          SESSION,
          JSON.stringify({ code, host, id: this.id, token: this.token }),
        );
      } catch {
        /* Session recovery is optional. */
      }
    });
    this.peer.on('connection', (link) => {
      if (!host) {
        link.close();
        return;
      }
      this.bind(link, own);
    });
    this.peer.on('error', (error) => {
      const type = (error as { type?: string }).type;
      if (type === 'peer-unavailable' && !host && this.joinAttempts < 4) {
        this.view.message = 'ホストを探しています。再接続中…';
        this.emit();
        return;
      }
      this.view.status = 'error';
      this.view.message =
        type === 'unavailable-id'
          ? 'このルーム番号は使用中です。新しいルームを作成してください。'
          : type === 'peer-unavailable'
            ? 'ルームが見つかりません。番号とホストの接続を確認してください。'
            : '接続できませんでした。回線または接続設定を確認してください。';
      this.emit();
    });
    this.peer.on('disconnected', () => {
      if (!this.disposed) {
        this.view.message = '接続サービスに再接続しています…';
        this.emit();
        try {
          this.peer.reconnect();
        } catch {
          /* The retry timer retains the room. */
        }
      }
    });
    this.timer = setInterval(() => {
      if (this.disposed) return;
      if (!host) {
        const link = this.links.get('host');
        if (link?.open) {
          this.send(link, { type: 'ping', time: Date.now() });
          if (Date.now() - this.lastSeen > 8000) {
            this.view.paused = true;
            this.view.message = 'ホストからの応答を待っています…';
            this.emit();
          }
        } else if (
          this.peer.open &&
          this.joinAttempts < 4 &&
          !this.reconnecting
        )
          this.connectHost(own);
      }
    }, 2000);
    this.emit();
  }
  private emit() {
    if (!this.disposed)
      this.callbacks.change({
        ...this.view,
        members: this.view.members.map((m) => ({ ...m })),
        config: { ...this.view.config },
      });
  }
  private send(link: DataConnection, data: unknown) {
    if (link.open) {
      try {
        link.send(data);
      } catch {
        /* Connection events handle recovery. */
      }
    }
  }
  private broadcast(data: unknown) {
    for (const link of this.links.values()) this.send(link, data);
  }
  private roster() {
    this.broadcast({
      type: 'roster',
      members: this.view.members,
      config: this.view.config,
      status: this.view.status,
      paused: this.view.paused,
    });
    this.emit();
  }
  private connectHost(own: Member) {
    this.joinAttempts++;
    this.reconnecting = true;
    const link = this.peer.connect(PREFIX + this.view.code, {
      reliable: false,
      serialization: 'json',
    });
    this.links.set('host', link);
    this.bind(link, own);
    setTimeout(() => {
      this.reconnecting = false;
      if (!link.open && !this.disposed) {
        link.close();
        if (this.joinAttempts >= 4) {
          this.view.status = 'error';
          this.view.message =
            '接続がタイムアウトしました。ルーム番号・回線・TURN設定を確認してください。';
          this.emit();
        }
      }
    }, 7000);
  }
  private bind(link: DataConnection, own: Member) {
    link.on('open', () => {
      if (!this.view.host)
        this.send(link, {
          type: 'hello',
          version: VERSION,
          member: own,
          token: this.token,
        });
    });
    link.on('data', (raw) => {
      if (this.disposed) return;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const msg = raw as Record<string, unknown>;
      if (this.view.host) this.hostMessage(link, msg);
      else if (link === this.links.get('host')) this.guestMessage(link, msg);
    });
    const close = () => {
      if (this.disposed) return;
      if (this.view.host) {
        const id = this.linkMembers.get(link);
        if (id && this.links.get(id) === link) {
          this.links.delete(id);
          const m = this.view.members.find((m) => m.id === id);
          if (m) {
            m.connected = false;
            m.ready = false;
          }
          if (this.latest) {
            const r = this.latest.racers.find((r) => r.id === id);
            if (r) r.disconnected = true;
          }
          this.roster();
        }
      } else if (this.links.get('host') === link) {
        this.links.delete('host');
        this.view.paused = true;
        this.view.message = '接続が切れました。再接続しています…';
        this.reconnecting = false;
        this.emit();
      }
    };
    link.on('close', close);
    link.on('error', close);
    if (this.view.host)
      setTimeout(() => {
        if (!this.linkMembers.has(link)) link.close();
      }, 10000);
  }
  private hostMessage(link: DataConnection, msg: Record<string, unknown>) {
    if (msg.type === 'hello') {
      const m = msg.member as Member;
      if (
        msg.version !== VERSION ||
        !m ||
        typeof m.id !== 'string' ||
        m.id.length > 64 ||
        typeof m.name !== 'string' ||
        !Number.isInteger(m.kart) ||
        m.kart < 0 ||
        m.kart > 5 ||
        typeof msg.token !== 'string' ||
        msg.token.length > 64
      ) {
        link.close();
        return;
      }
      const existing = this.view.members.find((r) => r.id === m.id);
      if (existing && this.memberTokens.get(m.id) !== msg.token) {
        this.send(link, {
          type: 'reject',
          message: 'プレイヤーの認証に失敗しました。',
        });
        link.close();
        return;
      }
      if (
        !existing &&
        (this.view.members.length >= 8 || this.view.status === 'racing')
      ) {
        this.send(link, {
          type: 'reject',
          message:
            this.view.status === 'racing'
              ? 'レース中です。終了後に参加してください。'
              : 'ルームは満員です。',
        });
        return;
      }
      if (existing) {
        const old = this.links.get(m.id);
        this.links.set(m.id, link);
        old?.close();
        existing.connected = true;
      } else {
        this.view.members.push({
          id: m.id,
          name: m.name.trim().slice(0, 16) || 'Player',
          kart: m.kart,
          cpu: false,
          ready: false,
          connected: true,
        });
        this.memberTokens.set(m.id, msg.token);
        this.links.set(m.id, link);
      }
      this.linkMembers.set(link, m.id);
      this.lastInput.delete(m.id);
      if (this.latest) {
        const r = this.latest.racers.find((r) => r.id === m.id);
        if (r) r.disconnected = false;
        this.send(link, { type: 'snapshot', state: this.latest });
      }
      this.roster();
      return;
    }
    const id = this.linkMembers.get(link);
    if (!id) return;
    if (msg.type === 'ping') {
      this.send(link, { type: 'pong', time: msg.time });
      return;
    }
    if (msg.type === 'ready' && this.view.status === 'lobby') {
      const member = this.view.members.find((m) => m.id === id);
      if (member) member.ready = msg.ready === true;
      this.roster();
    }
    if (msg.type === 'leave') {
      this.links.delete(id);
      this.linkMembers.delete(link);
      if (this.view.status === 'lobby') {
        this.view.members = this.view.members.filter((m) => m.id !== id);
        this.memberTokens.delete(id);
      } else {
        const m = this.view.members.find((m) => m.id === id);
        if (m) m.connected = false;
        const r = this.latest?.racers.find((r) => r.id === id);
        if (r) r.disconnected = true;
      }
      link.close();
      this.roster();
    }
    if (
      msg.type === 'input' &&
      this.view.status === 'racing' &&
      typeof msg.seq === 'number' &&
      Number.isSafeInteger(msg.seq)
    ) {
      const now = Date.now(),
        last = this.lastInput.get(id) ?? { seq: -1, time: now, count: 0 };
      if (msg.seq <= last.seq) return;
      if (now - last.time > 1000) {
        last.time = now;
        last.count = 0;
      }
      if (++last.count > 120) return;
      last.seq = msg.seq;
      this.lastInput.set(id, last);
      this.callbacks.input(id, cleanInput(msg.input));
    }
  }
  private guestMessage(link: DataConnection, msg: Record<string, unknown>) {
    this.lastSeen = Date.now();
    if (msg.type === 'reject') {
      this.view.status = 'error';
      this.view.message = String(msg.message).slice(0, 150);
      this.emit();
    }
    if (msg.type === 'pong' && typeof msg.time === 'number') {
      this.view.latency = Math.max(0, Math.min(9999, Date.now() - msg.time));
      this.emit();
    }
    if (
      msg.type === 'roster' &&
      validConfig(msg.config) &&
      Array.isArray(msg.members) &&
      msg.members.length <= 8 &&
      msg.members.every(
        (m) =>
          m &&
          typeof m.id === 'string' &&
          typeof m.name === 'string' &&
          Number.isInteger(m.kart) &&
          m.kart >= 0 &&
          m.kart < 6,
      )
    ) {
      this.joinAttempts = 0;
      this.view.members = msg.members as Member[];
      this.view.config = msg.config;
      this.view.status = msg.status === 'racing' ? 'racing' : 'lobby';
      this.view.paused = msg.paused === true;
      this.view.message = this.view.paused
        ? 'ホストが戻るまで待機しています。'
        : '接続しました';
      this.emit();
    }
    if (msg.type === 'snapshot' && isSnapshot(msg.state)) {
      this.view.status = 'racing';
      this.latest = msg.state;
      this.callbacks.race(msg.state);
    }
    if (msg.type === 'lobby') {
      this.latest = null;
      this.callbacks.lobby();
    }
    if (msg.type === 'closed') {
      this.view.status = 'error';
      this.view.message = 'ホストがルームを終了しました。';
      this.emit();
      link.close();
      this.joinAttempts = 4;
    }
  }
  ready(ready: boolean) {
    if (this.view.host) {
      const own = this.view.members.find((m) => m.id === this.id);
      if (own) own.ready = ready;
      this.roster();
    } else {
      const link = this.links.get('host');
      if (link) this.send(link, { type: 'ready', ready });
    }
  }
  configure(config: RaceConfig) {
    if (!this.view.host || this.view.status !== 'lobby') return;
    this.view.config = { ...config, mode: 'online' };
    for (const m of this.view.members) if (m.id !== this.id) m.ready = false;
    this.roster();
  }
  start() {
    if (!this.view.host || this.view.status !== 'lobby') return;
    const members = this.view.members.filter((m) => m.connected);
    if (members.length < 2 || members.some((m) => !m.ready)) return;
    this.view.status = 'racing';
    this.view.paused = false;
    this.roster();
    this.callbacks.start(this.view.config, members);
  }
  publish(state: RaceState) {
    if (!this.view.host) return;
    this.latest = state;
    this.broadcast({ type: 'snapshot', state });
  }
  sendInput(input: Input) {
    const link = this.links.get('host');
    if (link) this.send(link, { type: 'input', seq: ++this.inputSeq, input });
  }
  pause(paused: boolean) {
    if (!this.view.host) return;
    this.view.paused = paused;
    this.roster();
  }
  returnToLobby() {
    if (!this.view.host) return;
    this.latest = null;
    this.view.status = 'lobby';
    this.view.paused = false;
    this.view.members = this.view.members.filter((m) => m.connected);
    for (const m of this.view.members) m.ready = m.id === this.id;
    this.broadcast({ type: 'lobby' });
    this.callbacks.lobby();
    this.roster();
  }
  dispose(clear = true) {
    this.disposed = true;
    clearInterval(this.timer);
    if (this.view.host) this.broadcast({ type: 'closed' });
    else {
      const link = this.links.get('host');
      if (link) this.send(link, { type: 'leave' });
    }
    setTimeout(() => this.peer.destroy(), 80);
    if (clear) {
      try {
        sessionStorage.removeItem(SESSION);
      } catch {
        /* Storage is optional. */
      }
    }
  }
}
