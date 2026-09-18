import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Flag,
  Gamepad2,
  Globe2,
  Link,
  Maximize,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import QRCode from 'qrcode';
import { KARTS, ITEMS } from './game/catalog';
import { formatTime } from './game/engine';
import { getTrack, TRACKS } from './game/tracks';
import type { Mode, RaceConfig, Settings } from './game/types';
import { Runtime } from './lib/runtime';
import { audio } from './lib/audio';
import {
  cleanCode,
  DEFAULT_CONNECTION,
  newCode,
  readRoomSession,
  roomLink,
  type ConnectionSettings,
} from './lib/network';
import { readRecords, readSettings, saveSettings } from './lib/storage';
import { KartArt } from './components/KartArt';
import { Modal } from './components/Modal';
import { SceneCanvas } from './components/SceneCanvas';
import { TouchControls } from './components/TouchControls';
import { TrackMap } from './components/TrackMap';

const MODES: {
  id: Mode;
  label: string;
  en: string;
  description: string;
  icon: typeof Flag;
}[] = [
  {
    id: 'race',
    label: 'クイックレース',
    en: 'QUICK RACE',
    description: '好きなコースで、8台の真剣勝負。',
    icon: Flag,
  },
  {
    id: 'cup',
    label: 'グランプリ',
    en: 'GRAND PRIX',
    description: '3つの世界を走り、カップをつかもう。',
    icon: Trophy,
  },
  {
    id: 'time',
    label: 'タイムアタック',
    en: 'TIME ATTACK',
    description: '昨日の自分を、追い越していこう。',
    icon: Clock3,
  },
  {
    id: 'online',
    label: 'フレンドレース',
    en: 'PLAY WITH FRIENDS',
    description: 'ルームをつくって、離れた友だちと。',
    icon: Users,
  },
];
const config = (
  mode: Mode,
  track: number,
  laps: number,
  difficulty: number,
  assist: boolean,
): RaceConfig => ({
  mode,
  track,
  laps,
  difficulty,
  assist,
  seed: Math.floor(Math.random() * 2147483647),
});

export function App() {
  const [hasTouch, setHasTouch] = useState(
    () =>
      navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    const rememberTouch = (event: PointerEvent) => {
      if (event.pointerType === 'touch') setHasTouch(true);
    };
    window.addEventListener('pointerdown', rememberTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', rememberTouch);
  }, []);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const runtime = useMemo(() => new Runtime(settings), []);
  const view = useSyncExternalStore(runtime.subscribe, runtime.snapshot);
  const [track, setTrack] = useState(0),
    [mode, setMode] = useState<Mode>('race'),
    [difficulty, setDifficulty] = useState(1),
    [laps, setLaps] = useState(3);
  const [dialog, setDialog] = useState<
    'settings' | 'help' | 'records' | 'online' | null
  >(null);
  const [renderError, setRenderError] = useState(''),
    [code, setCode] = useState(''),
    [connection, setConnection] = useState<ConnectionSettings>({
      ...DEFAULT_CONNECTION,
    });
  const [copied, setCopied] = useState(''),
    [qr, setQr] = useState(''),
    [fullscreenError, setFullscreenError] = useState('');
  const closeDialog = useCallback(() => setDialog(null), []),
    onRenderError = useCallback((value: string) => setRenderError(value), []);
  useEffect(() => {
    runtime.updateSettings(settings);
    saveSettings(settings);
  }, [runtime, settings]);
  useEffect(() => () => runtime.dispose(), [runtime]);
  useEffect(() => {
    const invite = cleanCode(
      new URLSearchParams(location.search).get('room') || '',
    );
    if (invite.length === 6) {
      setCode(invite);
      setMode('online');
      setDialog('online');
    }
  }, []);
  useEffect(() => {
    if (view.room?.code)
      void QRCode.toDataURL(roomLink(view.room.code), {
        width: 140,
        margin: 1,
        color: { dark: '#183f38', light: '#ffffff' },
      })
        .then(setQr)
        .catch(() => setQr(''));
  }, [view.room?.code]);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...patch }));
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 2200);
    } catch {
      setCopied('コピーできません。リンクを選択してコピーしてください。');
    }
  };
  const start = () => {
    audio.unlock();
    if (mode === 'online') setDialog('online');
    else runtime.start(mode, track, difficulty, laps);
  };
  const connect = (host: boolean, restore = false) => {
    const old = restore ? readRoomSession() : null;
    const target = old?.code ?? (host ? newCode() : code);
    if (target.length !== 6) return;
    audio.unlock();
    runtime.connect(
      old?.host ?? host,
      target,
      config('online', track, laps, difficulty, settings.assist),
      connection,
      restore,
    );
    setDialog(null);
  };
  const requestFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError('このブラウザーでは全画面表示を利用できません。');
      setTimeout(() => setFullscreenError(''), 4000);
    }
  };
  const home = () => {
    runtime.home();
    const url = new URL(location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      history.replaceState(null, '', url);
    }
  };
  const racing = view.screen === 'race',
    results = view.screen === 'results',
    lobby = view.screen === 'lobby';
  const race = view.race,
    player = race?.racers.find((r) => r.id === view.localIds[0]),
    item = player?.item ? ITEMS[player.item] : null;
  const selectedKart = KARTS[settings.kart];
  const records = dialog === 'records' ? readRecords() : [];
  const room = view.room;
  const self = room?.members.find((m) => m.id === runtime.network?.id);
  const cupFinal =
    results && race?.config.mode === 'cup' && view.cupRound === 2;
  const resultRacers = race
    ? [...race.racers].sort((a, b) =>
        cupFinal
          ? (view.points[b.id] ?? 0) - (view.points[a.id] ?? 0) ||
            a.rank - b.rank
          : a.rank - b.rank,
      )
    : [];
  return (
    <div
      className={`app ${hasTouch ? 'touch-device' : ''} ${racing ? 'is-racing' : ''} ${results ? 'is-results' : ''} ${lobby ? 'is-lobby' : ''}`}
    >
      <div
        className={`scene-shell ${racing || results ? 'scene-race' : 'scene-home'}`}
      >
        <SceneCanvas
          runtime={runtime}
          quality={settings.quality}
          track={track}
          onError={onRenderError}
        />
      </div>
      {!racing && !results && (
        <header className="site-header">
          <button className="brand" onClick={home} aria-label="KARTLINE ホーム">
            <span className="brand-mark">
              <Flag size={24} strokeWidth={2.6} />
            </span>
            KARTLINE<span className="brand-dot">✳</span>
          </button>
          <nav aria-label="メインナビゲーション">
            <button className={!lobby ? 'nav-active' : ''} onClick={home}>
              プレイ
            </button>
            <button onClick={() => setDialog('help')}>遊び方</button>
            <button onClick={() => setDialog('records')}>レコード</button>
          </nav>
          <div className="header-actions">
            <span className="header-tag">
              <span />
              NO DOWNLOAD. JUST RACE.
            </span>
            <button
              className="icon-button"
              aria-label="設定"
              onClick={() => setDialog('settings')}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
      )}
      {renderError && (
        <div role="alert" className="render-error">
          <strong>3Dレンダラー</strong>
          <p>{renderError}</p>
          <button
            className="secondary"
            onClick={() => {
              saveSettings({ ...settings, quality: 'low' });
              location.reload();
            }}
          >
            軽量設定で再読み込み
          </button>
        </div>
      )}
      {view.screen === 'home' && (
        <main className="home-content">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-flag">▧</span> THE EVERYDAY RACING CLUB
              </div>
              <h1 id="hero-title">
                小さなカートで、
                <br />
                <span>大きな冒険へ。</span>
              </h1>
              <p>
                アクセルひとつで、日常を飛び出そう。
                <br />
                ひとりでも、友だちとも。ここが君のスタートライン。
              </p>
              <div className="hero-actions">
                <a
                  className="primary"
                  href="#race-setup"
                  onClick={() => audio.unlock()}
                >
                  さっそく走る <ArrowUpRight size={20} />
                </a>
                <button
                  className="text-button"
                  onClick={() => setDialog('help')}
                >
                  <span className="play-circle">
                    <Play size={12} fill="currentColor" />
                  </span>
                  遊び方を見る
                </button>
              </div>
              <div className="hero-features">
                <span>
                  <Globe2 size={15} />
                  ブラウザーで遊べる
                </span>
                <span>
                  <Gamepad2 size={16} />
                  スマホ・PC対応
                </span>
                <span>
                  <Users size={15} />
                  最大8人
                </span>
              </div>
            </div>
            <div className="scene-label">
              <span className="live-dot" /> {TRACKS[track].subtitle}
              <span className="scene-label-detail">
                LIVE 3D PREVIEW <ArrowUpRight size={13} />
              </span>
            </div>
            <div className="hero-stamp">
              GOOD TIMES.
              <br />
              <b>GREAT RACES.</b>
              <span>✳</span>
            </div>
          </section>
          <section
            className="play-section"
            id="race-setup"
            aria-labelledby="play-heading"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 — PICK YOUR PLAY</span>
                <h2 id="play-heading">今日は、どう走る？</h2>
              </div>
              <span className="section-aside">YOUR NEXT LITTLE ADVENTURE</span>
            </div>
            <div className="mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`mode-card ${mode === m.id ? 'selected' : ''}`}
                  onClick={() => {
                    setMode(m.id);
                    audio.play('click');
                  }}
                  aria-pressed={mode === m.id}
                >
                  <div className="mode-card-top">
                    <m.icon size={22} />
                    <span className="selection-dot">
                      {mode === m.id && <Check size={12} />}
                    </span>
                  </div>
                  <span className="mode-en">{m.en}</span>
                  <h3>{m.label}</h3>
                  <p>{m.description}</p>
                </button>
              ))}
            </div>
            <div className="local-mode">
              <span>
                <Monitor size={16} />
                同じ画面で、となりのライバルと。
              </span>
              <button
                className={mode === 'local' ? 'local-selected' : ''}
                onClick={() => setMode(mode === 'local' ? 'race' : 'local')}
                aria-pressed={mode === 'local'}
              >
                {mode === 'local' ? <Check size={15} /> : <Plus size={15} />}
                画面分割で2人プレイ
                <ChevronRight size={15} />
              </button>
            </div>
          </section>
          <div className="setup-columns">
            <section
              className="course-section"
              aria-labelledby="course-heading"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">02 — CHOOSE YOUR WORLD</span>
                  <h2 id="course-heading">どこへ行こう。</h2>
                </div>
                <span className="small-badge">3 COURSES</span>
              </div>
              <div className="track-grid">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    className={`track-card track-${t.id} ${track === t.id ? 'selected' : ''}`}
                    onClick={() => setTrack(t.id)}
                    aria-pressed={track === t.id}
                    disabled={mode === 'cup'}
                  >
                    <div className="track-visual">
                      <span className="track-tag">{t.tag}</span>
                      <TrackMap track={t.id} />
                      <div className="track-artwork">
                        <span />
                        <span />
                        <span />
                      </div>
                      {track === t.id && (
                        <span className="track-check">
                          <Check size={15} />
                        </span>
                      )}
                    </div>
                    <div className="track-description">
                      <span className="track-subtitle">{t.subtitle}</span>
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      <span className="track-difficulty">
                        {t.difficulty}
                        <span>
                          {Math.round(getTrack(t.id).length / 10) * 10} m CLASS
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {mode === 'cup' && (
                <p className="inline-note">
                  <Trophy size={15} />
                  グランプリは全3コースを順番に走ります。
                </p>
              )}
              {mode === 'time' && (
                <p className="inline-note">
                  <Clock3 size={15} />
                  3周のタイムを計測。ベスト記録のゴーストと勝負できます。
                </p>
              )}
            </section>
            <section className="garage" aria-labelledby="garage-heading">
              <div className="garage-heading">
                <div>
                  <span className="eyebrow">03 — MEET YOUR RIDE</span>
                  <h2 id="garage-heading">君の相棒。</h2>
                </div>
                <span className="garage-number">
                  0{settings.kart + 1}
                  <small>/06</small>
                </span>
              </div>
              <div
                className="garage-art"
                style={
                  { '--kart-color': selectedKart.color } as React.CSSProperties
                }
              >
                <span className="garage-word" aria-hidden="true">
                  {selectedKart.name}
                </span>
                <KartArt kart={settings.kart} />
                <span className="kart-role">{selectedKart.role}</span>
              </div>
              <div className="garage-details">
                <strong>{selectedKart.label}</strong>
                <span>{selectedKart.tagline}</span>
              </div>
              <div className="kart-picker" aria-label="カートを選択">
                {KARTS.map((k, i) => (
                  <button
                    key={k.name}
                    aria-label={k.label}
                    aria-pressed={settings.kart === i}
                    onClick={() => update({ kart: i })}
                    style={{ background: k.color }}
                  >
                    {settings.kart === i && <Check size={17} />}
                  </button>
                ))}
              </div>
              <div className="kart-stats">
                {[
                  ['SPEED', selectedKart.speed],
                  ['ACCEL', selectedKart.acceleration],
                  ['HANDLING', selectedKart.handling],
                ].map(([name, value]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <div>
                      <i
                        style={{ width: `${(Number(value) / 1.25) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <label className="name-field">
                ドライバー名
                <input
                  value={settings.name}
                  maxLength={16}
                  onChange={(e) => update({ name: e.target.value })}
                  onBlur={() => {
                    if (!settings.name.trim()) update({ name: 'Player' });
                  }}
                  placeholder="Player"
                />
              </label>
            </section>
          </div>
          <section className="start-bar" aria-label="レース設定">
            <div className="start-options">
              <label>
                CPUの強さ
                <select
                  aria-label="CPUの強さ"
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  disabled={mode === 'time'}
                >
                  <option value={0}>やさしい · 50 cc</option>
                  <option value={1}>ふつう · 100 cc</option>
                  <option value={2}>むずかしい · 150 cc</option>
                </select>
              </label>
              <label>
                周回数
                <select
                  aria-label="周回数"
                  value={mode === 'time' ? 3 : laps}
                  onChange={(e) => setLaps(Number(e.target.value))}
                  disabled={mode === 'time'}
                >
                  <option value={1}>1 LAP</option>
                  <option value={3}>3 LAPS</option>
                  <option value={5}>5 LAPS</option>
                </select>
              </label>
              <span className="start-mode-note">
                <ShieldCheck size={18} />
                {settings.assist
                  ? 'ステアリングアシスト ON'
                  : 'ステアリングアシスト OFF'}
                <small>
                  {settings.autoAccelerate ? '自動アクセル ON' : '手動アクセル'}
                </small>
              </span>
            </div>
            <button
              className="primary start-button"
              onClick={start}
              disabled={!!renderError}
            >
              {mode === 'online'
                ? '友だちと走る'
                : mode === 'local'
                  ? '2人でレースをはじめる'
                  : 'レースをはじめる'}
              <ArrowRight size={21} />
            </button>
          </section>
          <section className="controls-strip">
            <div>
              <span className="keyboard-keys">
                <kbd>←</kbd>
                <kbd>→</kbd>
              </span>
              <span>ハンドル</span>
            </div>
            <div>
              <kbd>SHIFT</kbd>
              <span>ドリフト</span>
            </div>
            <div>
              <kbd>SPACE</kbd>
              <span>アイテム</span>
            </div>
            <div className="touch-hint">
              <Gamepad2 size={17} />
              <span>スマホは画面のボタンで操作</span>
            </div>
            <button className="text-button" onClick={() => setDialog('help')}>
              すべての操作
              <ArrowUpRight size={15} />
            </button>
          </section>
          <footer className="site-footer">
            <span className="footer-brand">
              <Flag size={16} />
              KARTLINE
            </span>
            <span>A little escape. A lot of fun.</span>
            <span>
              ORIGINAL KART RACING <span className="footer-star">✳</span> MADE
              FOR EVERYONE
            </span>
          </footer>
        </main>
      )}
      {lobby && (
        <main className="lobby-layout">
          <div className="lobby-intro">
            <span className="eyebrow">
              <Wifi size={15} /> FRIENDS ON THE GRID
            </span>
            <h1>
              集合したら、
              <br />
              スタート。
            </h1>
            <p>
              ルーム番号やリンクを友だちに送って、
              <br />
              同じコースで競い合おう。
            </p>
            <button className="text-button" onClick={home}>
              <ArrowLeft size={16} />
              ルームを退出
            </button>
          </div>
          <section className="lobby-panel" aria-label="オンラインルーム">
            <div className="lobby-title">
              <h2>フレンドルーム</h2>
              <span
                className={`connection-badge ${room?.status === 'error' ? 'is-error' : ''}`}
              >
                <span />
                {room?.status === 'connecting'
                  ? '接続中'
                  : room?.status === 'error'
                    ? '接続エラー'
                    : 'ONLINE'}
              </span>
            </div>
            {room && (
              <>
                <div className="room-code">
                  <div>
                    <span>ROOM CODE</span>
                    <strong data-testid="room-code">{room.code}</strong>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="ルーム番号をコピー"
                    onClick={() => copy(room.code, '番号をコピーしました')}
                  >
                    <Copy size={19} />
                  </button>
                </div>
                <div className="room-share">
                  <button
                    className="secondary"
                    onClick={() =>
                      copy(roomLink(room.code), '招待リンクをコピーしました')
                    }
                  >
                    <Link size={16} />
                    招待リンクをコピー
                  </button>
                  <input
                    aria-label="招待リンク"
                    readOnly
                    value={roomLink(room.code)}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <span>{copied || '2〜8人 / 空いた席にはCPUが参加'}</span>
                </div>
                <div className="lobby-members">
                  {room.members.map((m, i) => (
                    <div key={m.id} className="member">
                      <span
                        className="member-avatar"
                        style={{ background: KARTS[m.kart].color }}
                      >
                        {m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>
                          {m.name}
                          {m.id === runtime.network?.id && '（あなた）'}
                        </strong>
                        <small>{i === 0 ? 'HOST' : `PLAYER 0${i + 1}`}</small>
                      </div>
                      <span
                        className={`member-status ${m.ready ? 'ready' : ''}`}
                      >
                        {!m.connected ? (
                          '再接続待ち'
                        ) : m.ready ? (
                          <>
                            <Check size={14} />
                            準備OK
                          </>
                        ) : (
                          '準備中'
                        )}
                      </span>
                    </div>
                  ))}
                  {Array.from(
                    { length: Math.max(0, 2 - room.members.length) },
                    (_, i) => (
                      <div key={`empty-${i}`} className="member empty-member">
                        <span className="member-avatar">
                          <Plus size={20} />
                        </span>
                        <div>
                          <strong>友だちを待っています</strong>
                          <small>SHARE YOUR ROOM CODE</small>
                        </div>
                      </div>
                    ),
                  )}
                </div>
                <div className="lobby-config">
                  <label>
                    コース
                    <select
                      value={room.config.track}
                      disabled={!room.host || room.status !== 'lobby'}
                      onChange={(e) =>
                        runtime.network?.configure({
                          ...room.config,
                          track: Number(e.target.value),
                        })
                      }
                    >
                      {TRACKS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    周回数
                    <select
                      aria-label="周回数"
                      value={room.config.laps}
                      disabled={!room.host || room.status !== 'lobby'}
                      onChange={(e) =>
                        runtime.network?.configure({
                          ...room.config,
                          laps: Number(e.target.value),
                        })
                      }
                    >
                      <option value={1}>1周</option>
                      <option value={3}>3周</option>
                      <option value={5}>5周</option>
                    </select>
                  </label>
                </div>
                <div className="lobby-bottom">
                  <div className="qr-wrap">
                    {qr && (
                      <img
                        src={qr}
                        alt="ルーム招待用QRコード"
                        width="86"
                        height="86"
                      />
                    )}
                    <span>
                      スマホで読み取って参加
                      <br />
                      <small>
                        {room.host
                          ? 'ホストがコースを選びます'
                          : 'ホストの設定が適用されます'}
                      </small>
                    </span>
                  </div>
                  <p className="connection-message" role="status">
                    {room.message}
                  </p>
                  {room.status === 'error' ? (
                    <button
                      className="primary"
                      onClick={() => {
                        home();
                        setDialog('online');
                      }}
                    >
                      接続をやり直す
                      <RotateCcw size={18} />
                    </button>
                  ) : room.host ? (
                    <button
                      className="primary full-width"
                      disabled={
                        room.status !== 'lobby' ||
                        room.members.filter((m) => m.connected).length < 2 ||
                        room.members.some((m) => m.connected && !m.ready)
                      }
                      onClick={() => runtime.network?.start()}
                    >
                      みんなでスタート
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      className={`primary full-width ${self?.ready ? 'ready-button' : ''}`}
                      disabled={room.status !== 'lobby'}
                      onClick={() => runtime.network?.ready(!self?.ready)}
                    >
                      {self?.ready ? '準備を取り消す' : '準備OK'}
                      <Check size={19} />
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      )}
      {racing && race && player && (
        <main
          className={`race-ui ${race.config.mode === 'local' ? 'split-ui' : ''}`}
          aria-label="レース画面"
        >
          <div className="race-top">
            <div className="position-badge">
              <strong data-testid="position">
                {player.rank}
                <small>{['st', 'nd', 'rd'][player.rank - 1] || 'th'}</small>
              </strong>
              <span>/ {race.racers.length} KARTS</span>
            </div>
            <div className="race-progress">
              <span className="race-course">
                {TRACKS[race.config.track].subtitle}
              </span>
              <div>
                <span className="lap-counter">
                  LAP <b data-testid="lap">{player.lap}</b> / {race.config.laps}
                </span>
                <span className="race-time" data-testid="race-time">
                  {formatTime(race.time)}
                </span>
              </div>
              {race.config.mode === 'cup' && (
                <small>GRAND PRIX · ROUND {view.cupRound + 1} / 3</small>
              )}
            </div>
            <div className="race-top-actions">
              {room && (
                <span className="ping">
                  <Wifi size={13} />
                  {room.host ? 'HOST' : `${room.latency}ms`}
                </span>
              )}
              <button
                className="race-icon"
                onClick={requestFullscreen}
                aria-label="全画面表示"
              >
                <Maximize size={18} />
              </button>
              <button
                className="race-icon"
                onClick={() => runtime.togglePause()}
                aria-label="一時停止"
              >
                <Pause size={20} />
              </button>
              {room && !room.host && (
                <button
                  className="race-icon"
                  onClick={() => setDialog('settings')}
                  aria-label="設定"
                >
                  <Settings2 size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="race-left">
            <div className={`item-slot ${item ? 'has-item' : ''}`}>
              <span>{item ? item.icon : '?'}</span>
              <div>
                <strong data-testid="held-item">
                  {item ? item.name : 'アイテム'}
                </strong>
                <small>
                  {item ? 'SPACE / E で使う' : 'ボックスを通過してゲット'}
                </small>
              </div>
            </div>
            <ol className="live-standings">
              {[...race.racers]
                .sort((a, b) => a.rank - b.rank)
                .slice(0, 4)
                .map((r) => (
                  <li key={r.id} className={r.id === player.id ? 'you' : ''}>
                    <span>{r.rank.toString().padStart(2, '0')}</span>
                    <i style={{ background: KARTS[r.kart].color }} />
                    <strong>{r.name}</strong>
                    {r.id === player.id && <small>YOU</small>}
                  </li>
                ))}
            </ol>
          </div>
          <div className="race-right">
            <TrackMap
              track={race.config.track}
              race={race}
              player={player.id}
              className="minimap"
            />
            <div className="coins">
              <span>◉</span>
              {player.coins.toString().padStart(2, '0')}
              <small>/ 10</small>
            </div>
          </div>
          {race.config.mode === 'local' && (
            <>
              <div className="split-divider" />
              <div className="player-label p1">P1 · WASD / Q / E</div>
              <div className="player-label p2">P2 · 矢印 / 右SHIFT / ENTER</div>
              <div className="second-rank">
                {race.racers.find((r) => r.id === view.localIds[1])?.rank}位{' '}
                <small>
                  LAP {race.racers.find((r) => r.id === view.localIds[1])?.lap}/
                  {race.config.laps}
                </small>
              </div>
            </>
          )}
          <div className="speedometer">
            <strong data-testid="speed">
              {Math.round(player.speed * 3.6)}
            </strong>
            <span>KM/H</span>
            <div className="speed-line">
              <i
                style={{
                  width: `${Math.min(100, (player.speed / 55) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="race-bottom">
            <span>
              {settings.autoAccelerate ? 'AUTO ACCEL' : '↑ / W  アクセル'}
            </span>
            <span>← → ハンドル</span>
            <span>SHIFT ドリフト</span>
            <span>SPACE アイテム</span>
          </div>
          {player.driftCharge > 0.15 && (
            <div
              className={`drift-meter ${player.driftCharge >= 1.2 ? 'charged' : ''}`}
            >
              <span>
                {player.driftCharge >= 2
                  ? 'SUPER TURBO'
                  : player.driftCharge >= 0.65
                    ? 'RELEASE TO BOOST'
                    : 'DRIFT CHARGING'}
              </span>
              <div>
                <i
                  style={{
                    width: `${Math.min(100, (player.driftCharge / 2) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          {player.boost > 0 && player.spin <= 0 && (
            <div className="boost-indicator">
              <Zap size={20} /> TURBO!
            </div>
          )}
          {player.spin > 0 && <div className="hit-indicator">SPIN!</div>}
          {race.phase === 'countdown' && (
            <div className="countdown" role="status">
              <span>READY TO RACE</span>
              <strong>
                {race.countdown > 3 ? 'READY' : Math.ceil(race.countdown)}
              </strong>
              <small>
                {settings.autoAccelerate
                  ? 'スタートと同時に自動で加速します'
                  : '↑ / W またはアクセルボタンで加速'}
              </small>
            </div>
          )}
          {race.phase === 'racing' && race.time < 1 && (
            <div className="countdown go">
              <strong>GO!</strong>
            </div>
          )}
          {player.finished && (
            <div className="finish-wait">
              <Flag size={25} />
              <strong>FINISH!</strong>
              <span>
                ほかのプレイヤーを待っています ·{' '}
                {Math.ceil(Math.max(0, 30 - race.endTimer))}秒
              </span>
            </div>
          )}
          {!view.paused && race.config.mode !== 'local' && (
            <TouchControls
              input={runtime.input}
              item={item?.name || 'ITEM'}
              disabled={!item || race.phase !== 'racing'}
            />
          )}
          {fullscreenError && (
            <div className="race-toast" role="status">
              {fullscreenError}
            </div>
          )}
          {(view.paused || room?.status === 'error') && (
            <div className="pause-backdrop">
              <section className="pause-panel">
                <span className="eyebrow">TAKE A BREATHER</span>
                <h1>
                  {room?.status === 'error'
                    ? '接続が切れました'
                    : room && !room.host
                      ? 'ホストを待っています'
                      : 'ひとやすみ。'}
                </h1>
                <p>
                  {room?.status === 'error'
                    ? room.message
                    : room && !room.host
                      ? 'ホストがレースを再開するまでお待ちください。'
                      : '準備ができたら、またコースへ。'}
                </p>
                {(!room || room.host) && room?.status !== 'error' && (
                  <button
                    className="primary full-width"
                    onClick={() => runtime.togglePause()}
                  >
                    <Play size={18} />
                    レースに戻る
                  </button>
                )}
                <button
                  className="secondary full-width"
                  onClick={() => setDialog('settings')}
                >
                  <Settings2 size={17} />
                  設定を変える
                </button>
                <button className="text-button" onClick={home}>
                  レースを終了してホームへ
                </button>
              </section>
            </div>
          )}
        </main>
      )}
      {results && race && player && (
        <main className="results-backdrop">
          <section className="results-panel">
            <div className="result-heading">
              <span className="eyebrow">
                {cupFinal
                  ? 'GRAND PRIX COMPLETE'
                  : race.config.mode === 'time'
                    ? 'TIME ATTACK COMPLETE'
                    : 'THAT WAS A GOOD RACE'}
              </span>
              <div className="result-trophy">
                <Trophy size={36} />
              </div>
              <h1>
                {view.newRecord
                  ? '自己ベスト更新！'
                  : cupFinal
                    ? 'カップの行方は。'
                    : player.rank === 1
                      ? 'いちばんの景色。'
                      : 'ナイスラン。次は、もっと。'}
              </h1>
              <p>
                {cupFinal
                  ? '3レースの総合結果'
                  : TRACKS[race.config.track].name}
                {race.config.mode === 'cup' &&
                  !cupFinal &&
                  ` · ROUND ${view.cupRound + 1} / 3`}
              </p>
            </div>
            <div className="result-summary">
              <div>
                <span>{cupFinal ? '総合順位' : 'あなたの順位'}</span>
                <strong>
                  {cupFinal
                    ? resultRacers.findIndex((r) => r.id === player.id) + 1
                    : player.rank}
                  <small> / {race.racers.length}</small>
                </strong>
              </div>
              <div>
                <span>レースタイム</span>
                <strong className="time-result">
                  {player.finishTime ? formatTime(player.finishTime) : 'DNF'}
                </strong>
              </div>
              <div>
                <span>{cupFinal ? '獲得ポイント' : 'ベストラップ'}</span>
                <strong className="time-result">
                  {cupFinal
                    ? `${view.points[player.id]} pts`
                    : player.laps.length
                      ? formatTime(Math.min(...player.laps))
                      : '--'}
                </strong>
              </div>
            </div>
            <ol className="results-list">
              {resultRacers.map((r, i) => (
                <li
                  key={r.id}
                  className={view.localIds.includes(r.id) ? 'you' : ''}
                >
                  <span className="result-rank">
                    {(i + 1).toString().padStart(2, '0')}
                  </span>
                  <span
                    className="result-avatar"
                    style={{ background: KARTS[r.kart].color }}
                  >
                    {r.name.slice(0, 1)}
                  </span>
                  <strong>
                    {r.name}
                    <small>
                      {r.cpu
                        ? 'CPU'
                        : view.localIds.includes(r.id)
                          ? 'YOU'
                          : 'PLAYER'}
                    </small>
                  </strong>
                  <span>
                    {cupFinal
                      ? `${view.points[r.id]} pts`
                      : r.finishTime
                        ? formatTime(r.finishTime)
                        : '未完走'}
                  </span>
                </li>
              ))}
            </ol>
            {race.config.mode === 'time' && (
              <div className="lap-times">
                {player.laps.map((time, i) => (
                  <span key={i}>
                    LAP {i + 1}
                    <b>{formatTime(time)}</b>
                  </span>
                ))}
              </div>
            )}
            <div className="result-actions">
              <button className="secondary" onClick={home}>
                <ArrowLeft size={17} />
                ホームへ
              </button>
              {(!room || room.host) && (
                <button className="primary" onClick={() => runtime.next()}>
                  {room
                    ? 'ルームに戻る'
                    : race.config.mode === 'cup' && !cupFinal
                      ? '次のコースへ'
                      : 'もう一度走る'}
                  <ArrowRight size={19} />
                </button>
              )}
              {room && !room.host && (
                <span className="inline-note">
                  ホストが次のレースを準備しています
                </span>
              )}
            </div>
          </section>
        </main>
      )}
      {view.notice && !view.paused && (
        <div className="notice" role="status">
          <span>{view.notice}</span>
          <button
            className="icon-button"
            aria-label="通知を閉じる"
            onClick={() => runtime.clearNotice()}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === 'settings' && (
        <Modal title="ドライブを、自分好みに。" onClose={closeDialog}>
          <div className="settings-grid">
            <label className="toggle-row">
              <span>
                <Volume2 size={18} />
                サウンド<small>エンジン音と効果音</small>
              </span>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => {
                  audio.unlock();
                  update({ sound: e.target.checked });
                }}
              />
            </label>
            <label className="range-row">
              音量
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
              />
              <span>{Math.round(settings.volume * 100)}%</span>
            </label>
            <label className="toggle-row">
              <span>
                <Zap size={18} />
                自動アクセル<small>ハンドルとドリフトに集中</small>
              </span>
              <input
                type="checkbox"
                checked={settings.autoAccelerate}
                onChange={(e) => update({ autoAccelerate: e.target.checked })}
              />
            </label>
            <label className="toggle-row">
              <span>
                <ShieldCheck size={18} />
                ステアリングアシスト
                <small>コースへの復帰とカーブを補助 · 次のレースから適用</small>
              </span>
              <input
                type="checkbox"
                checked={settings.assist}
                onChange={(e) => update({ assist: e.target.checked })}
              />
            </label>
            <label className="toggle-row">
              <span>
                バイブレーション<small>対応端末で衝突をお知らせ</small>
              </span>
              <input
                type="checkbox"
                checked={settings.vibration}
                onChange={(e) => update({ vibration: e.target.checked })}
              />
            </label>
            <label className="select-row">
              グラフィック
              <select
                value={settings.quality}
                onChange={(e) =>
                  update({ quality: e.target.value as Settings['quality'] })
                }
              >
                <option value="auto">自動</option>
                <option value="high">高画質</option>
                <option value="low">軽量 · バッテリー優先</option>
              </select>
            </label>
          </div>
          <p className="modal-note">
            設定と自己ベストは、このブラウザーに保存されます。
          </p>
          {room && !room.host && racing && (
            <button
              className="secondary full-width"
              onClick={() => {
                closeDialog();
                home();
              }}
            >
              レースを退出してホームへ
            </button>
          )}
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title="最初のコーナーへ。" onClose={closeDialog} wide>
          <p className="help-intro">
            ゴールまでの速さを競う、8台のカートレース。
            <br />
            まずは自動アクセルとアシストをONにして走ってみよう。
          </p>
          <div className="help-cards">
            <article>
              <span>01</span>
              <h3>曲がって、ためて、加速。</h3>
              <p>
                ハンドルを切りながらドリフトを長押し。ゲージがたまったら離してミニターボ。長くためるほど加速が続きます。
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>アイテムで、逆転しよう。</h3>
              <p>
                緑の「?」ボックスを通るとアイテムを獲得。コインを集めると最高速度が上がり、黄色いパネルで加速できます。
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>友だちが、ライバルに。</h3>
              <p>
                フレンドレースからルームを作成。番号・リンク・QRで招待し、全員が準備OKになったらホストがスタート。
              </p>
            </article>
          </div>
          <div className="controls-table">
            <table>
              <caption>キーボード操作</caption>
              <thead>
                <tr>
                  <th>操作</th>
                  <th>ひとり / オンライン</th>
                  <th>画面分割 P1</th>
                  <th>画面分割 P2</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['ハンドル', '← → / A D', 'A D', '← →'],
                  ['アクセル / ブレーキ', '↑ ↓ / W S', 'W S', '↑ ↓'],
                  ['ドリフト', 'SHIFT / Q', '左SHIFT / Q', '右SHIFT'],
                  ['アイテム', 'SPACE / E', 'SPACE / E', 'ENTER / /'],
                  ['一時停止', 'ESC / P', 'ESC / P', 'ESC / P'],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) =>
                      i === 0 ? (
                        <th key={i}>{cell}</th>
                      ) : (
                        <td key={i}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="modal-note">
            スマホは左右のボタンとDRIFT・ITEMを同時にタッチ。横向きで広く遊べます。ゲームパッドは左スティックでハンドル、Aでドリフト、Bでアイテム、RTでアクセル、LTでブレーキ。
          </p>
          <div className="item-guide">
            {Object.entries(ITEMS).map(([key, value]) => (
              <div key={key}>
                <span>{value.icon}</span>
                <strong>
                  {value.name}
                  <small>{value.description}</small>
                </strong>
              </div>
            ))}
          </div>
          <p className="modal-note">
            タイムアタックはアイテム・コインなしの3周勝負。グランプリは順位に応じて15・12・10・8・6・4・2・1ポイントを獲得します。オンラインではホストが一時停止でき、切断された参加者はCPUが代走します。
          </p>
        </Modal>
      )}
      {dialog === 'records' && (
        <Modal title="君が残した、スタートライン。" onClose={closeDialog}>
          <span className="eyebrow">TIME ATTACK RECORDS · 3 LAPS</span>
          <div className="records-list">
            {TRACKS.map((t) => {
              const record = records.find((r) => r.track === t.id);
              return (
                <article key={t.id}>
                  <TrackMap track={t.id} />
                  <div>
                    <h3>{t.name}</h3>
                    <strong>
                      {record
                        ? formatTime(record.time)
                        : 'まだ記録がありません'}
                    </strong>
                    <small>
                      {record
                        ? new Date(record.date).toLocaleDateString('ja-JP')
                        : 'タイムアタックで記録を残そう'}
                    </small>
                  </div>
                  {view.screen === 'home' && (
                    <button
                      className="icon-button"
                      aria-label={`${t.name}に挑戦`}
                      onClick={() => {
                        closeDialog();
                        runtime.start('time', t.id, difficulty, 3);
                      }}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="modal-note">
            自己ベストを更新するとゴーストを保存。次の挑戦で、前回の走りと競えます。
          </p>
        </Modal>
      )}
      {dialog === 'online' && (
        <Modal title="友だちを、スタートラインへ。" onClose={closeDialog}>
          <p className="modal-note">
            最大8人でオンライン対戦。空いた席にはCPUが参加します。
          </p>
          <label className="field-label">
            ドライバー名
            <input
              value={settings.name}
              maxLength={16}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Player"
            />
          </label>
          <button className="primary full-width" onClick={() => connect(true)}>
            <Plus size={19} />
            ルームをつくる
          </button>
          <div className="or-divider">または番号で参加</div>
          <form
            className="join-form"
            onSubmit={(e) => {
              e.preventDefault();
              connect(false);
            }}
          >
            <label className="sr-only" htmlFor="room-code-input">
              ルーム番号
            </label>
            <input
              id="room-code-input"
              value={code}
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={6}
              onChange={(e) => setCode(cleanCode(e.target.value))}
            />
            <button
              className="secondary"
              type="submit"
              disabled={code.length !== 6}
            >
              参加する
              <ArrowRight size={18} />
            </button>
          </form>
          {readRoomSession() && (
            <button
              className="text-button restore-room"
              onClick={() => connect(false, true)}
            >
              <RotateCcw size={15} />
              前のルームに再接続
            </button>
          )}
          <details className="network-settings">
            <summary>
              接続設定
              <Settings2 size={15} />
            </summary>
            <p>
              通常は設定不要です。接続できないネットワークでは、利用できるTURNサーバーを指定してください。
            </p>
            <label className="field-label">
              TURN URL
              <input
                placeholder="turn:relay.example.com:3478"
                value={connection.turnUrl}
                onChange={(e) =>
                  setConnection((c) => ({ ...c, turnUrl: e.target.value }))
                }
              />
            </label>
            <div className="field-pair">
              <label className="field-label">
                ユーザー名
                <input
                  autoComplete="off"
                  value={connection.turnUser}
                  onChange={(e) =>
                    setConnection((c) => ({ ...c, turnUser: e.target.value }))
                  }
                />
              </label>
              <label className="field-label">
                パスワード
                <input
                  type="password"
                  autoComplete="off"
                  value={connection.turnPassword}
                  onChange={(e) =>
                    setConnection((c) => ({
                      ...c,
                      turnPassword: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field-label">
              PeerServerホスト（任意）
              <input
                placeholder="peer.example.com"
                value={connection.server}
                onChange={(e) =>
                  setConnection((c) => ({ ...c, server: e.target.value }))
                }
              />
            </label>
            <div className="field-pair">
              <label className="field-label">
                ポート
                <input
                  inputMode="numeric"
                  value={connection.port}
                  onChange={(e) =>
                    setConnection((c) => ({ ...c, port: e.target.value }))
                  }
                />
              </label>
              <label className="field-label">
                パス
                <input
                  value={connection.path}
                  onChange={(e) =>
                    setConnection((c) => ({ ...c, path: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={connection.secure}
                onChange={(e) =>
                  setConnection((c) => ({ ...c, secure: e.target.checked }))
                }
              />
              TLSを使用
            </label>
            <p>認証情報は保存・共有されません。</p>
          </details>
        </Modal>
      )}
    </div>
  );
}
