import { CPU_NAMES, CUP_POINTS } from '../game/catalog';
import { createRace, STEP, stepRace } from '../game/engine';
import type {
  GhostPoint,
  Input,
  Mode,
  RaceConfig,
  RacerSpec,
  RaceState,
  Settings,
} from '../game/types';
import { audio } from './audio';
import { InputManager } from './input';
import { NetworkRoom, type ConnectionSettings, type RoomView } from './network';
import { readRecords, saveRecord } from './storage';

export interface RuntimeView {
  screen: 'home' | 'lobby' | 'race' | 'results';
  race: RaceState | null;
  paused: boolean;
  room: RoomView | null;
  localIds: string[];
  cupRound: number;
  points: Record<string, number>;
  newRecord: boolean;
  notice: string;
}
export class Runtime {
  race: RaceState | null = null;
  network: NetworkRoom | null = null;
  input: InputManager;
  settings: Settings;
  view: RuntimeView = {
    screen: 'home',
    race: null,
    paused: false,
    room: null,
    localIds: [],
    cupRound: 0,
    points: {},
    newRecord: false,
    notice: '',
  };
  ghost: GhostPoint[] | null = null;
  private listeners = new Set<() => void>();
  private accumulator = 0;
  private uiTime = 0;
  private networkTime = 0;
  private eventId = 0;
  private ghostTime = 0;
  private recording: GhostPoint[] = [];
  private remoteInputs: Record<string, { input: Input; time: number }> = {};
  private visibility: () => void;
  private lastTick = 0;
  constructor(settings: Settings) {
    this.settings = settings;
    this.input = new InputManager(() => this.togglePause());
    this.visibility = () => {
      if (
        document.hidden &&
        this.view.screen === 'race' &&
        (!this.network || this.network.view.host)
      ) {
        this.view.paused = true;
        this.input.clear();
        this.network?.pause(true);
        this.emit();
      }
    };
    document.addEventListener('visibilitychange', this.visibility);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.view;
  private emit() {
    this.view = {
      ...this.view,
      race: this.race,
      points: { ...this.view.points },
    };
    this.listeners.forEach((fn) => fn());
  }
  updateSettings(settings: Settings) {
    this.settings = settings;
    audio.enabled = settings.sound;
    audio.volume = settings.volume;
    this.input.autoAccelerate = settings.autoAccelerate;
  }
  start(mode: Mode, track: number, difficulty: number, laps: number) {
    this.view.points = {};
    this.view.cupRound = 0;
    this.view.room = null;
    this.view.notice = '';
    const specs: RacerSpec[] = [
      {
        id: 'player-1',
        name: this.settings.name,
        kart: this.settings.kart,
        cpu: false,
      },
    ];
    if (mode === 'local')
      specs.push({
        id: 'player-2',
        name: 'Player 2',
        kart: (this.settings.kart + 1) % 6,
        cpu: false,
      });
    this.view.localIds = specs.map((p) => p.id);
    this.begin(
      {
        mode,
        track: mode === 'cup' ? 0 : track,
        difficulty,
        laps: mode === 'time' ? 3 : laps,
        assist: this.settings.assist,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      },
      specs,
    );
  }
  private begin(config: RaceConfig, specs: RacerSpec[]) {
    if (config.mode !== 'time')
      while (specs.length < 8) {
        const i = specs.length;
        specs.push({
          id: `cpu-${i}`,
          name: CPU_NAMES[(i - 1) % CPU_NAMES.length],
          kart: i % 6,
          cpu: true,
        });
      }
    this.race = createRace(config, specs);
    this.view.screen = 'race';
    this.view.paused = false;
    this.view.newRecord = false;
    this.accumulator = 0;
    this.eventId = 0;
    this.remoteInputs = {};
    this.recording = [];
    this.ghostTime = 0;
    this.ghost =
      config.mode === 'time'
        ? (readRecords().find((r) => r.track === config.track)?.ghost ?? null)
        : null;
    this.input.clear();
    this.input.active = true;
    this.input.local = config.mode === 'local';
    this.input.autoAccelerate = this.settings.autoAccelerate;
    audio.unlock();
    this.network?.publish(this.race);
    this.emit();
  }
  connect(
    host: boolean,
    code: string,
    config: RaceConfig,
    connection: ConnectionSettings,
    restore = false,
  ) {
    this.network?.dispose(false);
    this.race = null;
    this.view.screen = 'lobby';
    this.view.paused = false;
    this.view.notice = '';
    const room = new NetworkRoom(
      host,
      code,
      this.settings.name,
      this.settings.kart,
      config,
      connection,
      {
        change: (view) => {
          this.view.room = view;
          if (!view.host) this.view.paused = view.paused;
          if (view.status === 'error') {
            this.view.notice = view.message;
            this.input.active = false;
          }
          this.emit();
        },
        input: (id, input) => {
          this.remoteInputs[id] = { input, time: performance.now() };
        },
        start: (config, specs) => {
          this.view.localIds = [this.network!.id];
          this.begin(config, [...specs]);
        },
        race: (state) => {
          this.race = state;
          this.view.localIds = [this.network!.id];
          if (state.phase === 'finished') {
            if (this.view.screen !== 'results') this.finish();
          } else {
            this.view.screen = 'race';
            this.input.active = !this.view.paused;
            this.input.autoAccelerate = this.settings.autoAccelerate;
          }
          this.emit();
        },
        lobby: () => {
          this.race = null;
          this.view.screen = 'lobby';
          this.view.paused = false;
          this.input.active = false;
          this.emit();
        },
      },
      restore,
    );
    this.network = room;
    this.view.localIds = [room.id];
    this.emit();
  }
  togglePause() {
    if (this.view.screen !== 'race') return;
    if (this.network && !this.network.view.host) {
      this.view.notice = 'オンラインの一時停止はホストが操作します。';
      this.emit();
      return;
    }
    this.view.paused = !this.view.paused;
    this.input.clear();
    this.input.active = !this.view.paused;
    this.network?.pause(this.view.paused);
    this.emit();
  }
  private finish() {
    if (!this.race || this.view.screen === 'results') return;
    this.view.screen = 'results';
    this.input.active = false;
    this.view.paused = false;
    for (const r of this.race.racers)
      this.view.points[r.id] =
        (this.view.points[r.id] || 0) + (CUP_POINTS[r.rank - 1] || 0);
    const player = this.race.racers.find((r) => r.id === this.view.localIds[0]);
    if (this.race.config.mode === 'time' && player?.finishTime)
      this.view.newRecord = saveRecord({
        track: this.race.config.track,
        time: player.finishTime,
        date: new Date().toISOString(),
        ghost: this.recording.slice(0, 4000),
      });
    this.emit();
  }
  next() {
    if (!this.race) return;
    if (this.network) {
      this.network.returnToLobby();
      return;
    }
    const config = { ...this.race.config },
      specs = this.race.racers.map(({ id, name, kart, cpu }) => ({
        id,
        name,
        kart,
        cpu,
      }));
    if (config.mode === 'cup' && this.view.cupRound < 2) {
      this.view.cupRound++;
      config.track = this.view.cupRound;
    } else {
      this.view.cupRound = 0;
      this.view.points = {};
      if (config.mode === 'cup') config.track = 0;
    }
    config.seed++;
    this.begin(config, specs);
  }
  home() {
    this.network?.dispose();
    this.network = null;
    this.race = null;
    this.view = {
      screen: 'home',
      race: null,
      paused: false,
      room: null,
      localIds: [],
      cupRound: 0,
      points: {},
      newRecord: false,
      notice: '',
    };
    this.input.active = false;
    this.input.clear();
    this.ghost = null;
    this.emit();
  }
  clearNotice() {
    this.view.notice = '';
    this.emit();
  }
  frame(now: number) {
    const dt = this.lastTick ? Math.min((now - this.lastTick) / 1000, 0.1) : 0;
    this.lastTick = now;
    this.input.active =
      this.view.screen === 'race' &&
      !this.view.paused &&
      this.view.room?.status !== 'error';
    if (this.race && this.view.screen === 'race' && !this.view.paused) {
      this.networkTime += dt;
      if (this.network && !this.network.view.host) {
        if (this.networkTime > 1 / 30) {
          this.network.sendInput(this.input.read());
          this.networkTime = 0;
        }
      } else {
        this.accumulator += dt;
        while (this.accumulator >= STEP) {
          const inputs: Record<string, Input> = {};
          this.view.localIds.forEach(
            (id, i) => (inputs[id] = this.input.read(i)),
          );
          for (const [id, value] of Object.entries(this.remoteInputs))
            if (now - value.time < 500) inputs[id] = value.input;
          stepRace(this.race, inputs);
          this.accumulator -= STEP;
          if (
            this.race.config.mode === 'time' &&
            this.race.phase === 'racing' &&
            this.race.time - this.ghostTime >= 0.1
          ) {
            const r = this.race.racers[0];
            this.recording.push({
              t: this.race.time,
              s: r.s,
              offset: r.offset,
              yaw: r.yaw,
              lift: r.lift,
            });
            this.ghostTime = this.race.time;
          }
          if (this.race.phase === 'finished') {
            this.network?.publish(this.race);
            this.finish();
            break;
          }
        }
        if (this.networkTime > 1 / 15) {
          this.network?.publish(this.race);
          this.networkTime = 0;
        }
      }
    }
    const player = this.race?.racers.find(
      (r) => r.id === this.view.localIds[0],
    );
    audio.update(
      player?.speed ?? 0,
      this.view.screen === 'race' &&
        !this.view.paused &&
        this.race?.phase === 'racing',
    );
    if (this.race)
      for (const event of this.race.events)
        if (event.id > this.eventId) {
          this.eventId = event.id;
          if (event.racer === player?.id || event.racer === 'all') {
            audio.play(event.type);
            if (event.type === 'hit' && this.settings.vibration)
              navigator.vibrate?.(70);
          }
        }
    this.uiTime += dt;
    if (this.uiTime > 0.09 && this.view.screen === 'race') {
      this.uiTime = 0;
      this.emit();
    }
    return dt;
  }
  dispose() {
    this.network?.dispose(false);
    this.input.dispose();
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
