// ------------------------------------------------------------------
// Hilfsfunktionen für die 3D-Darstellung
// ------------------------------------------------------------------
import * as THREE from 'three';

export function addMesh(geometry, material, parent) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Canvas als Textur (für Anzeigen, Beschriftungen und den Leuchtschirm)
export function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

/**
 * Beschriftung als Fläche. Höhe in cm, Breite ergibt sich aus dem Text.
 * Optionen: color, background (oder null), bold
 */
export function makeTextPlane(text, height, { color = '#1d2733', background = null, bold = true } = {}) {
  const px = 96;                              // Pixel pro Texthöhe
  const font = `${bold ? 'bold ' : ''}${px * 0.62}px system-ui, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width + px * 0.5);
  const { ctx, texture } = canvasTexture(width, px);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, px);
  }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, px * 0.54);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: !background });
  return new THREE.Mesh(new THREE.PlaneGeometry(height * width / px, height), material);
}

// Weiches Kabel als Röhre durch Stützpunkte; liegt nie unter der Tischplatte (y ≥ floorY)
export function makeCable(points, material, parent, floorY, radius = 0.3) {
  const rough = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const samples = rough.getSpacedPoints(160).map(p => { p.y = Math.max(p.y, floorY + radius); return p; });
  const curve = new THREE.CatmullRomCurve3(samples);
  return addMesh(new THREE.TubeGeometry(curve, 200, radius, 10, false), material, parent);
}

// Zahl mit deutschem Dezimalkomma
export const formatNumber = (value, digits) => value.toFixed(digits).replace('.', ',');
