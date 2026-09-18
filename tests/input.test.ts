import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InputManager } from '../src/lib/input';
let input: InputManager;
beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  input = new InputManager(() => {});
  input.active = true;
});
afterEach(() => {
  input.dispose();
  vi.unstubAllGlobals();
});
function key(type: string, code: string) {
  window.dispatchEvent(
    Object.assign(new Event(type, { cancelable: true }), {
      code,
      repeat: false,
    }),
  );
}
it('buffers an item press released between simulation frames', () => {
  key('keydown', 'Space');
  key('keyup', 'Space');
  expect(input.read().item).toBe(true);
  expect(input.read().item).toBe(false);
});
it('buffers a short jump-action tap between simulation frames', () => {
  key('keydown', 'ShiftLeft');
  key('keyup', 'ShiftLeft');
  expect(input.read().drift).toBe(true);
  expect(input.read().drift).toBe(false);
});
it('keeps both players item taps separate', () => {
  input.local = true;
  key('keydown', 'Enter');
  key('keyup', 'Enter');
  expect(input.read(0).item).toBe(false);
  expect(input.read(1).item).toBe(true);
});
it('retains a direction until all fingers holding it are released', () => {
  input.touch('left', 1, true);
  input.touch('left', 2, true);
  input.touch('drift', 3, true);
  input.touch('left', 1, false);
  expect(input.read()).toMatchObject({ steer: -1, drift: true });
  input.touch('left', 2, false);
  expect(input.read().steer).toBe(0);
});
it('releases all keyboard and pointer controls on focus loss', () => {
  key('keydown', 'KeyD');
  input.touch('drift', 1, true);
  input.touch('item', 2, true);
  window.dispatchEvent(new Event('blur'));
  expect(input.read()).toMatchObject({ steer: 0, drift: false, item: false });
});
