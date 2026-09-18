import { ArrowLeft, ArrowRight, ArrowUp, Zap } from 'lucide-react';
import type { InputManager } from '../lib/input';
export function TouchControls({
  input,
  item,
  disabled,
}: {
  input: InputManager;
  item: string;
  disabled: boolean;
}) {
  const bindings = (action: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers release the pointer before capture can be established.
      }
      input.touch(action, e.pointerId, true);
      e.currentTarget.dataset.pressed = 'true';
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      input.touch(action, e.pointerId, false);
      delete e.currentTarget.dataset.pressed;
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      input.touch(action, e.pointerId, false);
      delete e.currentTarget.dataset.pressed;
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      input.touch(action, e.pointerId, false);
      delete e.currentTarget.dataset.pressed;
    },
  });
  return (
    <div className="touch-controls" aria-label="タッチ操作">
      <div className="touch-steer">
        <button aria-label="左に曲がる" {...bindings('left')}>
          <ArrowLeft />
        </button>
        <button aria-label="右に曲がる" {...bindings('right')}>
          <ArrowRight />
        </button>
      </div>
      <div className="touch-actions">
        <button className="touch-brake" {...bindings('brake')}>
          BRAKE
        </button>
        {!input.autoAccelerate && (
          <button aria-label="アクセル" {...bindings('throttle')}>
            <ArrowUp />
          </button>
        )}
        <button className="touch-drift" {...bindings('drift')}>
          DRIFT
        </button>
        <button
          className="touch-item"
          aria-label="アイテムを使う"
          disabled={disabled}
          {...bindings('item')}
        >
          <Zap size={22} />
          <span>{item}</span>
        </button>
      </div>
    </div>
  );
}
