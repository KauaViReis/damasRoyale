/* ============================================================
   DAMAS 3D — Tabuleiro 3D (casas, moldura, mesa)
   ============================================================ */

import * as THREE from 'three';
import { isDark } from './rules.js';

export function createBoard(scene, materials) {
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);

  /* Casas */
  const sqGeo = new THREE.BoxGeometry(1, 0.16, 1);
  const squares = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const m = new THREE.Mesh(sqGeo, isDark(r, c) ? materials.darkSq : materials.lightSq);
    m.position.set(c - 3.5, -0.08, r - 3.5);
    m.receiveShadow = true;
    m.userData = { sq: true, r, c };
    boardGroup.add(m);
    squares.push(m);
  }

  /* Moldura */
  const t = 0.55, h = 0.34, L = 8 + 2 * t;
  const mkFrame = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.frame);
    m.position.set(x, -0.16 + h / 2 - 0.18, z);
    m.castShadow = true;
    m.receiveShadow = true;
    boardGroup.add(m);
  };
  mkFrame(L, t, 0, -(4 + t / 2));
  mkFrame(L, t, 0, (4 + t / 2));
  mkFrame(t, 8, -(4 + t / 2), 0);
  mkFrame(t, 8, (4 + t / 2), 0);

  const base = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, L), materials.frame);
  base.position.y = -0.31;
  base.receiveShadow = true;
  base.castShadow = true;
  boardGroup.add(base);

  /* Mesa */
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(8.6, 9.2, 0.5, 64),
    materials.table
  );
  table.position.y = -0.72;
  table.receiveShadow = true;
  scene.add(table);

  return { boardGroup, squares, table };
}

export function worldPos(r, c) {
  return new THREE.Vector3(c - 3.5, 0, r - 3.5);
}
