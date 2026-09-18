import { useEffect, useRef } from 'react';
import { RaceScene } from '../render/scene';
import type { Runtime } from '../lib/runtime';
import type { Settings } from '../game/types';
export function SceneCanvas({
  runtime,
  quality,
  track,
  onError,
}: {
  runtime: Runtime;
  quality: Settings['quality'];
  track: number;
  onError: (s: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    scene = useRef<RaceScene | null>(null);
  const selectedTrack = useRef(track);
  selectedTrack.current = track;
  useEffect(() => {
    let handle = 0;
    try {
      const view = new RaceScene(container.current!, quality, onError);
      scene.current = view;
      view.buildTrack(track);
      const frame = (now: number) => {
        const dt = runtime.frame(now);
        if (!runtime.race) view.buildTrack(selectedTrack.current);
        view.render(runtime.race, runtime.view.localIds, dt, runtime.ghost);
        handle = requestAnimationFrame(frame);
      };
      handle = requestAnimationFrame(frame);
      return () => {
        cancelAnimationFrame(handle);
        view.dispose();
        scene.current = null;
      };
    } catch {
      onError(
        '3D描画を開始できませんでした。WebGL 2対応ブラウザーで開いてください。',
      );
    }
  }, [runtime, quality, onError]);
  useEffect(() => {
    if (!runtime.race) scene.current?.buildTrack(track);
  }, [track, runtime]);
  return <div ref={container} className="scene-canvas" />;
}
