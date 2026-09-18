import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const materials = new Map<string, THREE.MeshStandardMaterial>();
export function batchStatic(
  root: THREE.Object3D,
  skip: Set<THREE.Object3D> = new Set(),
) {
  root.updateMatrixWorld(true);
  const groups = new Map<
    string,
    { material: THREE.Material; meshes: THREE.Mesh[] }
  >();
  root.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) ||
      Array.isArray(child.material) ||
      child.name
    )
      return;
    for (
      let parent: THREE.Object3D | null = child;
      parent;
      parent = parent.parent
    )
      if (skip.has(parent)) return;
    const key =
      child.material.uuid +
      Object.keys(child.geometry.attributes).join(',') +
      String(!!child.geometry.index);
    if (!groups.has(key))
      groups.set(key, { material: child.material, meshes: [] });
    groups.get(key)!.meshes.push(child);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const group of groups.values())
    if (group.meshes.length > 1) {
      const geometries = group.meshes.map((m) =>
        m.geometry
          .clone()
          .applyMatrix4(inverse.clone().multiply(m.matrixWorld)),
      );
      const merged = mergeGeometries(geometries);
      if (merged) {
        const output = new THREE.Mesh(merged, group.material);
        output.castShadow = group.meshes.some((m) => m.castShadow);
        output.receiveShadow = true;
        root.add(output);
        for (const m of group.meshes) {
          m.removeFromParent();
          m.geometry.dispose();
        }
      }
      geometries.forEach((g) => g.dispose());
    }
}
export function material(color: string, roughness = 0.78) {
  if (!materials.has(color))
    materials.set(color, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(color)!;
}
export function mesh(
  geometry: THREE.BufferGeometry,
  color: string,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geometry, material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(
  parent: THREE.Object3D,
  color: string,
  size: number[],
  pos: number[],
) {
  return mesh(
    new THREE.BoxGeometry(...(size as [number, number, number])),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
export function cylinder(
  parent: THREE.Object3D,
  color: string,
  top: number,
  bottom: number,
  height: number,
  pos: number[],
  segments = 8,
) {
  return mesh(
    new THREE.CylinderGeometry(top, bottom, height, segments),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
export function sphere(
  parent: THREE.Object3D,
  color: string,
  radius: number,
  pos: number[],
  detail = 1,
) {
  return mesh(
    new THREE.IcosahedronGeometry(radius, detail),
    color,
    parent,
    ...(pos as [number, number, number]),
  );
}
export function textSign(
  text: string,
  background: string,
  foreground: string,
  width = 11,
  height = 2.5,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 768, 192);
  ctx.fillStyle = foreground;
  ctx.font = '900 144px sans-serif';
  const fit = Math.min(
    144,
    (144 * 680) / Math.max(1, ctx.measureText(text).width),
  );
  ctx.font = `900 ${fit}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 101);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  return sign;
}
