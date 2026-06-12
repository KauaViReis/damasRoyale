/* ============================================================
   DAMAS 3D — Peças 3D (geometrias, materiais, animações)
   ============================================================ */

import * as THREE from 'three';
import { idx } from './rules.js';
import { worldPos } from './board3d.js';
import { tween, easeIO, easeOutBack, sleep } from './utils.js';

const PIECE_H = 0.17;

/* Geometrias compartilhadas (criadas uma vez) */
export function createGeometries() {
  /* Peça (lathe) */
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.30, 0),
    new THREE.Vector2(0.36, 0.025),
    new THREE.Vector2(0.37, 0.10),
    new THREE.Vector2(0.345, 0.125),
    new THREE.Vector2(0.30, 0.13),
    new THREE.Vector2(0.295, 0.155),
    new THREE.Vector2(0.22, 0.165),
    new THREE.Vector2(0.001, PIECE_H),
  ];
  const pieceGeo = new THREE.LatheGeometry(pts, 48);

  /* Coroa: disco */
  const crPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.21, 0),
    new THREE.Vector2(0.245, 0.03),
    new THREE.Vector2(0.235, 0.09),
    new THREE.Vector2(0.16, 0.115),
    new THREE.Vector2(0.001, 0.12),
  ];
  const crownDiscGeo = new THREE.LatheGeometry(crPts, 40);

  /* Coroa: anel dourado */
  const crownRingGeo = new THREE.TorusGeometry(0.235, 0.032, 16, 44);

  return { pieceGeo, crownDiscGeo, crownRingGeo, PIECE_H };
}

export function newPieceMat(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.08,
    clearcoat: 0.7, clearcoatRoughness: 0.25
  });
}

export function makePiece(scene, geos, player, r, c, theme) {
  const mat = newPieceMat(player === 1 ? theme.p1 : theme.p2);
  const mesh = new THREE.Mesh(geos.pieceGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const p = worldPos(r, c);
  mesh.position.set(p.x, 0, p.z);
  scene.add(mesh);
  const piece = { mesh, player, king: false, r, c };
  mesh.userData.piece = piece;
  return piece;
}

export function addCrown(piece, geos, goldMat, animate) {
  const disc = new THREE.Mesh(geos.crownDiscGeo, piece.mesh.material);
  disc.position.y = geos.PIECE_H;
  disc.castShadow = true;

  const ring = new THREE.Mesh(geos.crownRingGeo, goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = geos.PIECE_H + 0.012;
  ring.castShadow = true;

  const g = new THREE.Group();
  g.add(disc);
  g.add(ring);
  g.name = 'crown';
  piece.mesh.add(g);

  if (animate) {
    g.scale.set(0.01, 0.01, 0.01);
    tween(380, k => {
      const s = easeOutBack(k);
      g.scale.set(s, s, s);
    });
  }
}

export async function animateStep(piece, step, grid, onCapture) {
  const from = worldPos(piece.r, piece.c);
  const to = worldPos(step.r, step.c);
  const isCap = step.capR !== undefined;
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const dur = Math.min(620, 220 + dist * 70);
  const arc = isCap ? 0.55 : 0.16;

  let victim = null;
  if (isCap) {
    victim = grid[idx(step.capR, step.capC)];
    grid[idx(step.capR, step.capC)] = null;
  }
  grid[idx(piece.r, piece.c)] = null;
  piece.r = step.r;
  piece.c = step.c;
  grid[idx(step.r, step.c)] = piece;

  /* Animação de captura (paralela) */
  const capAnim = victim ? (async () => {
    await sleep(dur * 0.42);
    if (onCapture) onCapture(victim, step);
    const m = victim.mesh;
    await tween(300, k => {
      const e = easeIO(k);
      m.scale.set(1 - e * 0.85, 1 - e * 0.85, 1 - e * 0.85);
      m.position.y = -e * 0.35;
      m.rotation.z = e * 0.8;
    });
  })() : null;

  /* Animação de movimento (arco) */
  await tween(dur, k => {
    const e = easeIO(k);
    piece.mesh.position.x = from.x + (to.x - from.x) * e;
    piece.mesh.position.z = from.z + (to.z - from.z) * e;
    piece.mesh.position.y = Math.sin(e * Math.PI) * arc;
  });
  piece.mesh.position.set(to.x, 0, to.z);
  if (capAnim) await capAnim;
}
