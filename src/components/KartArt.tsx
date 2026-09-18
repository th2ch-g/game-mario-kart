import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { makeKart } from '../render/kart';
import { materials } from '../render/primitives';
import { KARTS } from '../game/catalog';

const previews = new Map<number, string>();
export function KartArt({ kart = 0 }: { kart?: number }) {
  const [preview, setPreview] = useState(previews.get(kart));
  useEffect(() => {
    if (previews.has(kart)) {
      setPreview(previews.get(kart));
      return;
    }
    let renderer: THREE.WebGLRenderer | undefined;
    const scene = new THREE.Scene();
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(480, 320);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      scene.add(new THREE.HemisphereLight('#f1ffff', '#829394', 2.4));
      const light = new THREE.DirectionalLight('#fff0d0', 2.4);
      light.position.set(-4, 8, 5);
      scene.add(light);
      scene.add(makeKart(kart));
      const camera = new THREE.PerspectiveCamera(34, 1.5, 0.1, 40);
      camera.position.set(-5.8, 3.8, 6.6);
      camera.lookAt(0, 0.95, 0);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      previews.set(kart, url);
      setPreview(url);
    } catch {
      setPreview(undefined);
    } finally {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const list = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const material of list)
            if (![...materials.values()].includes(material)) material.dispose();
        }
      });
      renderer?.dispose();
      renderer?.forceContextLoss();
    }
  }, [kart]);
  return preview ? (
    <img
      src={preview}
      className="kart-art"
      width="480"
      height="320"
      alt={`${KARTS[kart].label}の3Dカート`}
    />
  ) : (
    <span className="kart-art">{KARTS[kart].name}</span>
  );
}
