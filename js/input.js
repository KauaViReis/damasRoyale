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

    /* Pointer tracking */
    this.pointers = new Map();
    this.dragging = false;
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

    this._bind();
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(
      this.radius * Math.sin(this.phi) * Math.sin(this.theta),
      this.radius * Math.cos(this.phi),
      this.radius * Math.sin(this.phi) * Math.cos(this.theta)
    );
    this.camera.lookAt(0, -0.1, 0);
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

  _bind() {
    const c = this.canvas;

    c.addEventListener('pointerdown', e => {
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragging = true;
        this.downX = e.clientX;
        this.downY = e.clientY;
        this.moved = 0;
        if (this.onPointerDown) this.onPointerDown(e.clientX, e.clientY);
      } else if (this.pointers.size === 2) {
        const a = [...this.pointers.values()];
        this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      }
    });

    c.addEventListener('pointermove', e => {
      if (this.onPointerMove && this.pointers.size <= 1) {
        this.onPointerMove(e.clientX, e.clientY);
      }

      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1 && this.dragging) {
        this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.downX, e.clientY - this.downY));
        if (this.moved > 4 && (!this.isCustomDragging)) {
          this.theta -= dx * 0.0052;
          this.phi = clamp(this.phi - dy * 0.0042, 0.28, 1.32);
          this.syncCamera();
        }
      } else if (this.pointers.size === 2) {
        const a = [...this.pointers.values()];
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        this.radius = clamp(this.radius * (this.pinchD / Math.max(1, d)), 6.5, 19);
        this.pinchD = d;
        this.syncCamera();
      }
    });

    c.addEventListener('pointerup', e => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0 && this.dragging) {
        this.dragging = false;
        if (this.onPointerUp) this.onPointerUp(e.clientX, e.clientY, this.moved);
        if (this.moved < 14) {
          if (this.onClick) this.onClick(e.clientX, e.clientY);
        }
      }
    });

    c.addEventListener('pointercancel', e => this.pointers.delete(e.pointerId));

    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.radius = clamp(this.radius * (1 + e.deltaY * 0.0011), 6.5, 19);
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
