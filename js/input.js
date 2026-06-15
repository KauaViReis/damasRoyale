/* ============================================================
   DAMAS 3D — Controles de Câmera e Picking
   Orbit (arraste), zoom (scroll/pinça), picking por raycaster
   ============================================================ */

import * as THREE from 'three';
import { clamp } from './utils.js';
import { tween, easeIO } from './utils.js';

export class InputManager {
  constructor(canvas, camera, updateCamFn) {
    this.canvas = canvas;
    this.camera = camera;
    this.updateCam = updateCamFn;

    /* Orbit state */
    this.theta = 0;
    this.phi = 0.96;
    this.radius = 11.2;

    /* Alvo da câmera (permite deslocar/pan o tabuleiro) */
    this.target = new THREE.Vector3(0, -0.1, 0);
    this.minRadius = 5.5;
    this.maxRadius = 40;
    this.panLimit = 6;          /* até onde o alvo pode se afastar do centro */

    /* Modo "Mover": arraste de 1 dedo desloca a câmera (em vez de girar) */
    this.panMode = false;

    /* Pointer tracking */
    this.pointers = new Map();
    this.dragging = false;
    this.panning = false;       /* pan com 1 ponteiro (botão direito / Shift) */
    this.lastPanX = 0;
    this.lastPanY = 0;
    this.lastCentroid = null;   /* pan com 2 dedos */
    this.downX = 0;
    this.downY = 0;
    this.moved = 0;
    this.pinchD = 0;

    /* Raycaster */
    this.ray = new THREE.Raycaster();
    this.ptr = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    /* Rotação automática */
    this.autoRotating = false;
    this.autoRotateEnabled = true;

    /* Visão aérea (top-down) */
    this.topDown = false;
    this.savedPhi = this.phi;
    this.savedRadius = this.radius;
    this.animatingView = false;

    this._bind();
    this.syncCamera();
  }

  syncCamera() {
    const t = this.target;
    this.camera.position.set(
      t.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta),
      t.y + this.radius * Math.cos(this.phi),
      t.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta)
    );
    this.camera.lookAt(t);
  }

  /* Menor distância em que os 4 cantos do tabuleiro cabem na tela,
     para o ângulo (phi/theta) e a proporção atuais. Projeta os cantos
     de verdade (robusto para a perspectiva inclinada em telas verticais).
     margin > 1 deixa uma folga nas bordas. */
  fitRadius(margin = 1.06, phi = this.phi) {
    const half = 4.6;  /* metade da largura do tabuleiro + moldura */
    const corners = [[-half, -half], [half, -half], [-half, half], [half, half]];
    const v = new THREE.Vector3();
    const lim = 1 / margin;
    const t = this.target;
    const savedPos = this.camera.position.clone();
    const fitsAt = rad => {
      this.camera.position.set(
        t.x + rad * Math.sin(phi) * Math.sin(this.theta),
        t.y + rad * Math.cos(phi),
        t.z + rad * Math.sin(phi) * Math.cos(this.theta)
      );
      this.camera.lookAt(t);
      this.camera.updateMatrixWorld();
      for (const [x, z] of corners) {
        v.set(x, 0, z).project(this.camera);
        if (Math.abs(v.x) > lim || Math.abs(v.y) > lim) return false;
      }
      return true;
    };
    /* Bisseção: distância cresce → projeção encolhe (monotônico) */
    let lo = this.minRadius, hi = this.maxRadius, found = this.maxRadius;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (fitsAt(mid)) { found = mid; hi = mid; } else { lo = mid; }
    }
    /* Restaura a câmera */
    this.camera.position.copy(savedPos);
    this.camera.lookAt(t);
    this.camera.updateMatrixWorld();
    return clamp(found, this.minRadius, this.maxRadius);
  }

  /* Reenquadra ao redimensionar/girar a tela: afasta se o tabuleiro
     estiver cortado, sem forçar zoom-in indesejado. */
  refit() {
    const need = this.fitRadius();
    if (this.radius < need) this.radius = need;
    this.syncCamera();
  }

  /* Reseta o enquadramento (centraliza e ajusta a distância) */
  resetView() {
    this.target.set(0, -0.1, 0);
    this.radius = this.fitRadius();
    this.syncCamera();
  }

  /* Desloca o alvo da câmera no plano do tabuleiro (pan).
     dx/dy em pixels de tela. */
  pan(dx, dy) {
    const dir = new THREE.Vector3().subVectors(this.target, this.camera.position);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();                                  /* "para frente" no plano */
    const right = new THREE.Vector3(dir.z, 0, -dir.x); /* perpendicular, à direita */
    const k = this.radius * 0.0016;
    this.target.addScaledVector(right, -dx * k);
    this.target.addScaledVector(dir, -dy * k);
    this.target.x = clamp(this.target.x, -this.panLimit, this.panLimit);
    this.target.z = clamp(this.target.z, -this.panLimit, this.panLimit);
    this.syncCamera();
  }

  /* Rotação automática de 180° ao trocar turno */
  async autoRotate() {
    if (!this.autoRotateEnabled || this.autoRotating) return;
    this.autoRotating = true;
    const startTheta = this.theta;
    const targetTheta = startTheta + Math.PI;
    await tween(800, k => {
      const e = easeIO(k);
      this.theta = startTheta + (targetTheta - startTheta) * e;
      this.syncCamera();
    });
    this.theta = targetTheta;
    this.syncCamera();
    this.autoRotating = false;
  }

  /* Alterna entre a órbita livre e a visão aérea (quase ortogonal).
     Elimina a oclusão de peças no celular vertical. */
  async toggleTopDown() {
    if (this.animatingView) return this.topDown;
    this.animatingView = true;
    this.topDown = !this.topDown;
    let targetPhi, targetRadius;
    if (this.topDown) {
      this.savedPhi = this.phi;
      this.savedRadius = this.radius;
      targetPhi = 0.06;                  /* quase vertical (phi medido a partir do topo) */
      targetRadius = this.fitRadius(1.08, targetPhi); /* aéreo: fit no ângulo de destino */
    } else {
      targetPhi = this.savedPhi;
      targetRadius = this.savedRadius;
    }
    /* Recentraliza o tabuleiro ao alternar a visão */
    const t0v = this.target.clone();
    const tEnd = new THREE.Vector3(0, -0.1, 0);
    const p0 = this.phi, r0 = this.radius;
    await tween(450, k => {
      const e = easeIO(k);
      this.phi = p0 + (targetPhi - p0) * e;
      this.radius = r0 + (targetRadius - r0) * e;
      this.target.lerpVectors(t0v, tEnd, e);
      this.syncCamera();
    });
    this.phi = targetPhi;
    this.radius = targetRadius;
    this.target.copy(tEnd);
    this.syncCamera();
    this.animatingView = false;
    return this.topDown;
  }

  /* Hitbox de toque ampliado: retorna a peça mais próxima do toque
     (projetada na tela) dentro de um raio em pixels, ou null.
     pieceList: [{ mesh, ... }]. Tolera o dedo um pouco fora da peça. */
  pickNearestPiece(clientX, clientY, pieceList, maxPx = 40) {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best = null, bestD = maxPx;
    for (const p of pieceList) {
      v.copy(p.mesh.position).project(this.camera);
      const sx = rect.left + (v.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(clientX - sx, clientY - sy);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  _bind() {
    const c = this.canvas;

    /* Botão direito não abre o menu de contexto (usado para pan) */
    c.addEventListener('contextmenu', e => e.preventDefault());

    c.addEventListener('pointerdown', e => {
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragging = true;
        this.downX = e.clientX;
        this.downY = e.clientY;
        this.moved = 0;
        /* Pan com 1 ponteiro: botão direito/meio ou Shift+arraste */
        this.panning = (e.button === 2 || e.button === 1 || e.shiftKey);
        if (this.panning) {
          this.lastPanX = e.clientX;
          this.lastPanY = e.clientY;
        } else if (this.onPointerDown) {
          this.onPointerDown(e.clientX, e.clientY);
        }
      } else if (this.pointers.size === 2) {
        const a = [...this.pointers.values()];
        this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        this.lastCentroid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      }
    });

    c.addEventListener('pointermove', e => {
      if (this.onPointerMove && this.pointers.size <= 1 && !this.panning) {
        this.onPointerMove(e.clientX, e.clientY);
      }

      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1 && this.dragging) {
        this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.downX, e.clientY - this.downY));
        if (this.panning) {
          this.pan(dx, dy);                       /* deslocamento lateral */
        } else if (this.moved > 4 && !this.isCustomDragging) {
          if (this.panMode) {
            this.pan(dx, dy);                     /* modo Mover: 1 dedo desloca */
          } else {
            this.theta -= dx * 0.0052;
            this.phi = clamp(this.phi - dy * 0.0042, 0.28, 1.32);
            this.syncCamera();
          }
        }
      } else if (this.pointers.size === 2) {
        const a = [...this.pointers.values()];
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        /* Pinça = zoom */
        this.radius = clamp(this.radius * (this.pinchD / Math.max(1, d)), this.minRadius, this.maxRadius);
        this.pinchD = d;
        /* Arraste dos dois dedos (centroide) = pan */
        const cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
        if (this.lastCentroid) this.pan(cx - this.lastCentroid.x, cy - this.lastCentroid.y);
        this.lastCentroid = { x: cx, y: cy };
        this.syncCamera();
      }
    });

    c.addEventListener('pointerup', e => {
      this.pointers.delete(e.pointerId);
      this.lastCentroid = null;
      if (this.pointers.size === 0 && this.dragging) {
        this.dragging = false;
        const wasPanning = this.panning;
        this.panning = false;
        if (wasPanning) return;                   /* pan não conta como clique/jogada */
        if (this.onPointerUp) this.onPointerUp(e.clientX, e.clientY, this.moved);
        if (this.moved < 14) {
          if (this.onClick) this.onClick(e.clientX, e.clientY);
        }
      }
    });

    c.addEventListener('pointercancel', e => {
      this.pointers.delete(e.pointerId);
      this.lastCentroid = null;
    });

    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.radius = clamp(this.radius * (1 + e.deltaY * 0.0011), this.minRadius, this.maxRadius);
      this.syncCamera();
    }, { passive: false });
  }

  /* Raycasting: retorna { r, c } ou null */
  pick(clientX, clientY, targets) {
    const rect = this.canvas.getBoundingClientRect();
    this.ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.ptr, this.camera);
    const hit = this.ray.intersectObjects(targets, true)[0];
    return hit || null;
  }

  /* Raycasting no plano invisível (para Drag & Drop) */
  intersectPlane(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.ptr, this.camera);
    const target = new THREE.Vector3();
    this.ray.ray.intersectPlane(this.dragPlane, target);
    return target;
  }
}
