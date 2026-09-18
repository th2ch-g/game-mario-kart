import { EMPTY_INPUT, type Input } from '../game/types';
export class InputManager {
  private keys = new Set<string>();
  private touches = new Map<string, Set<number>>();
  private queuedItem = [false, false];
  private keydown: (e: KeyboardEvent) => void;
  private keyup: (e: KeyboardEvent) => void;
  private blur = () => this.clear();
  active = false;
  local = false;
  autoAccelerate = true;
  constructor(onPause: () => void) {
    const controlCodes = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'ShiftLeft',
      'ShiftRight',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyE',
      'KeyQ',
      'Enter',
      'Slash',
      'Escape',
      'KeyP',
    ];
    this.keydown = (e) => {
      if (
        !this.active ||
        (e.target instanceof HTMLElement &&
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      )
        return;
      if (controlCodes.includes(e.code)) e.preventDefault();
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) onPause();
      if (!e.repeat && ['Space', 'KeyE'].includes(e.code))
        this.queuedItem[0] = true;
      if (!e.repeat && ['Enter', 'Slash'].includes(e.code))
        this.queuedItem[1] = true;
      this.keys.add(e.code);
    };
    this.keyup = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
  }
  touch(action: string, pointer: number, pressed: boolean) {
    if (pressed) {
      if (action === 'item') this.queuedItem[0] = true;
      if (!this.touches.has(action)) this.touches.set(action, new Set());
      this.touches.get(action)!.add(pointer);
    } else this.touches.get(action)?.delete(pointer);
  }
  private pressed(action: string) {
    return !!this.touches.get(action)?.size;
  }
  read(player = 0): Input {
    if (!this.active) return { ...EMPTY_INPUT };
    const has = (...keys: string[]) => keys.some((k) => this.keys.has(k));
    const pending = this.queuedItem[player];
    this.queuedItem[player] = false;
    if (player === 1)
      return {
        throttle: this.autoAccelerate || has('ArrowUp') ? 1 : 0,
        brake: has('ArrowDown') ? 1 : 0,
        steer: (has('ArrowRight') ? 1 : 0) - (has('ArrowLeft') ? 1 : 0),
        drift: has('ShiftRight'),
        item: pending || has('Enter', 'Slash'),
      };
    const right =
        has('KeyD', ...(!this.local ? ['ArrowRight'] : [])) ||
        this.pressed('right'),
      left =
        has('KeyA', ...(!this.local ? ['ArrowLeft'] : [])) ||
        this.pressed('left');
    let result: Input = {
      throttle:
        this.autoAccelerate ||
        has('KeyW', ...(!this.local ? ['ArrowUp'] : [])) ||
        this.pressed('throttle')
          ? 1
          : 0,
      brake:
        has('KeyS', ...(!this.local ? ['ArrowDown'] : [])) ||
        this.pressed('brake')
          ? 1
          : 0,
      steer: Number(right) - Number(left),
      drift: has('ShiftLeft', 'KeyQ') || this.pressed('drift'),
      item: pending || has('Space', 'KeyE') || this.pressed('item'),
    };
    const gamepad = navigator.getGamepads?.()[0];
    if (gamepad) {
      const axis = gamepad.axes[0] ?? 0;
      result = {
        throttle: Math.max(result.throttle, gamepad.buttons[7]?.value ?? 0),
        brake: Math.max(result.brake, gamepad.buttons[6]?.value ?? 0),
        steer: Math.abs(axis) > 0.15 ? axis : result.steer,
        drift: result.drift || !!gamepad.buttons[0]?.pressed,
        item: result.item || !!gamepad.buttons[1]?.pressed,
      };
    }
    return result;
  }
  clear() {
    this.keys.clear();
    this.touches.clear();
    this.queuedItem = [false, false];
  }
  dispose() {
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
  }
}
