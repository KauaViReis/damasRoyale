/* ============================================================
   DAMAS 3D — Efeitos Visuais (partículas, destaques, marcações)
   ============================================================ */

import * as THREE from 'three';
import { worldPos } from './board3d.js';
import { tween, easeIO } from './utils.js';

export class FXManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.fxGroup = new THREE.Group();
    scene.add(this.fxGroup);

    /* Shake configuration */
    this.shakeIntensity = 0;
    this.cameraBasePos = new THREE.Vector3();

    /* Fireworks */
    this.fireworksOn = false;
    this.fwColor = 0xffffff;

    /* Clima (Weather) */
    this.weatherType = 'none';
    this.weatherMatDust = new THREE.MeshBasicMaterial({ color: 0xFCEBA7, transparent: true, opacity: 0.15, depthWrite: false });
    this.weatherMatSakura = new THREE.MeshBasicMaterial({ color: 0xFFB7C5, transparent: true, opacity: 0.8, depthWrite: false });
    this.weatherMatRain = new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.4, depthWrite: false });
    this.weatherMatEmber = new THREE.MeshBasicMaterial({ color: 0xFF5500, transparent: true, opacity: 0.9, depthWrite: false });

    /* Geometrias reutilizáveis */
    this.discGeo = new THREE.CircleGeometry(0.34, 40);
    this.ringGeo = new THREE.RingGeometry(0.40, 0.47, 44);
    this.markGeo = new THREE.PlaneGeometry(0.97, 0.97);
    this.particleGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

    this.activeFx = [];
    this.lastMarks = [];
    this.particles = [];
    
    /* Peça Fantasma */
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.3,
      depthWrite: false, wireframe: true
    });
    this.ghostGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 24);
    this.ghostMesh = new THREE.Mesh(this.ghostGeo, this.ghostMat);
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);
  }

  /* Disco indicador de destino */
  addDisc(r, c, color) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, depthWrite: false
    });
    const m = new THREE.Mesh(this.discGeo, mat);
    m.rotation.x = -Math.PI / 2;
    const p = worldPos(r, c);
    m.position.set(p.x, 0.02, p.z);
    m.userData = { r, c, ph: Math.random() * 6, kind: 'disc' };
    this.fxGroup.add(m);
    this.activeFx.push(m);
    return m;
  }

  /* Anel indicador de peça com captura obrigatória */
  addRing(r, c, color) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5,
      depthWrite: false, side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.rotation.x = -Math.PI / 2;
    const p = worldPos(r, c);
    m.position.set(p.x, 0.018, p.z);
    m.userData = { r, c, ph: Math.random() * 6, kind: 'ring' };
    this.fxGroup.add(m);
    this.activeFx.push(m);
  }

  /* Limpa todos os indicadores (discos + anéis) */
  clearFx() {
    for (const m of this.activeFx) this.fxGroup.remove(m);
    this.activeFx = [];
  }

  /* Remove apenas discos (mantém anéis) */
  clearDiscs() {
    this.activeFx = this.activeFx.filter(m => {
      if (m.userData.kind === 'disc') { this.fxGroup.remove(m); return false; }
      return true;
    });
  }

  /* Marca a última jogada */
  setLastMove(from, to) {
    for (const m of this.lastMarks) this.fxGroup.remove(m);
    this.lastMarks = [];
    for (const [r, c] of [from, to]) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xE3A94E, transparent: true, opacity: 0.14, depthWrite: false
      });
      const m = new THREE.Mesh(this.markGeo, mat);
      m.rotation.x = -Math.PI / 2;
      const p = worldPos(r, c);
      m.position.set(p.x, 0.012, p.z);
      this.fxGroup.add(m);
      this.lastMarks.push(m);
    }
  }

  clearLastMove() {
    for (const m of this.lastMarks) this.fxGroup.remove(m);
    this.lastMarks = [];
  }

  /* ====== PARTÍCULAS DE CAPTURA ====== */
  spawnCaptureParticles(r, c, color) {
    const origin = worldPos(r, c);
    const count = 10;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9
      });
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.copy(origin);
      m.position.y = 0.1;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.8 + Math.random() * 2.2;
      m.userData.vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 3,
        Math.sin(angle) * speed
      );
      m.userData.life = 0;
      m.userData.maxLife = 0.5 + Math.random() * 0.25;
      const s = 0.6 + Math.random() * 0.8;
      m.scale.set(s, s, s);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  /* ====== PARTÍCULAS DE COROAÇÃO ====== */
  spawnCrownParticles(r, c) {
    const origin = worldPos(r, c);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xD9AC3C, transparent: true, opacity: 1.0
      });
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.copy(origin);
      m.position.y = 0.2;
      const angle = (i / count) * Math.PI * 2;
      const radSpeed = 0.5 + Math.random() * 0.8;
      m.userData.vel = new THREE.Vector3(
        Math.cos(angle) * radSpeed,
        4 + Math.random() * 3,
        Math.sin(angle) * radSpeed
      );
      m.userData.life = 0;
      m.userData.maxLife = 0.7 + Math.random() * 0.3;
      m.userData.isCrown = true;
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  /* ====== CAMERA SHAKE ====== */
  shake(intensity = 0.5) {
    this.shakeIntensity = intensity;
  }

  /* ====== ZOOM PUNCH (FASE 9) ======
     Leve mergulho de FOV em eventos importantes (multicaptura, coroação) */
  zoomPunch(strength = 3) {
    if (!this.camera || this._punching) return;
    this._punching = true;
    const baseFov = this.camera.fov;
    tween(420, k => {
      const e = Math.sin(k * Math.PI);          /* vai e volta */
      this.camera.fov = baseFov - strength * e;
      this.camera.updateProjectionMatrix();
    }).then(() => {
      this.camera.fov = baseFov;
      this.camera.updateProjectionMatrix();
      this._punching = false;
    });
  }

  /* ====== POEIRA DE ATERRISSAGEM (FASE 9) ======
     Faíscas baixas e curtas no ponto onde a peça pousa */
  spawnLandingDust(r, c, color) {
    const origin = worldPos(r, c);
    const count = 7;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55
      });
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.set(origin.x, 0.04, origin.z);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.9 + Math.random() * 1.2;
      m.userData.vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.6 + Math.random() * 0.8,
        Math.sin(angle) * speed
      );
      m.userData.life = 0;
      m.userData.maxLife = 0.28 + Math.random() * 0.18;
      const s = 0.45 + Math.random() * 0.4;
      m.scale.set(s, s, s);
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  /* ====== PEÇA FANTASMA ====== */
  showGhost(r, c, color) {
    const p = worldPos(r, c);
    this.ghostMesh.position.set(p.x, 0.08, p.z);
    this.ghostMesh.material.color.set(color);
    this.ghostMesh.visible = true;
  }

  hideGhost() {
    this.ghostMesh.visible = false;
  }

  /* ====== FOGOS DE ARTIFÍCIO ====== */
  startFireworks(colorHex) {
    this.fireworksOn = true;
    this.fwColor = colorHex;
  }

  stopFireworks() {
    this.fireworksOn = false;
  }

  /* ====== CLIMA (WEATHER) ====== */
  setWeather(type) {
    this.weatherType = type;
  }

  /* Atualização por frame (chamada no loop principal) */
  update(time, dt) {
    /* Shake da câmera */
    if (this.shakeIntensity > 0 && this.camera) {
      if (this.cameraBasePos.lengthSq() === 0) this.cameraBasePos.copy(this.camera.position);
      
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      const dz = (Math.random() - 0.5) * this.shakeIntensity;
      
      this.camera.position.set(
        this.cameraBasePos.x + dx,
        this.cameraBasePos.y + dy,
        this.cameraBasePos.z + dz
      );
      
      this.shakeIntensity -= dt * 2.5;
      if (this.shakeIntensity <= 0) {
        this.shakeIntensity = 0;
        this.camera.position.copy(this.cameraBasePos);
        this.cameraBasePos.set(0, 0, 0);
      }
    }

    /* Animação dos indicadores */
    for (const m of this.activeFx) {
      m.material.opacity = (m.userData.kind === 'disc' ? 0.5 : 0.42)
        + 0.22 * Math.sin(time * 5 + m.userData.ph);
      if (m.userData.kind === 'ring') m.rotation.z = time * 0.8;
    }

    /* Clima Contínuo */
    if (this.weatherType !== 'none' && Math.random() < 0.35) {
      let mat, px, py, pz, vx, vy, vz, grav, ml;
      let sx = 1, sy = 1, sz = 1;

      if (this.weatherType === 'dust') {
        mat = this.weatherMatDust;
        px = (Math.random() - 0.5) * 20; py = Math.random() * 8; pz = (Math.random() - 0.5) * 20;
        vx = (Math.random() - 0.5) * 0.2; vy = (Math.random() - 0.5) * 0.2; vz = (Math.random() - 0.5) * 0.2;
        grav = 0; ml = 4 + Math.random() * 4;
        sx = 0.5; sy = 0.5; sz = 0.5;
      } else if (this.weatherType === 'sakura') {
        mat = this.weatherMatSakura;
        px = -10 + Math.random() * 20; py = 6 + Math.random() * 4; pz = (Math.random() - 0.5) * 20;
        vx = 2 + Math.random() * 2; vy = -1 - Math.random(); vz = (Math.random() - 0.5);
        grav = -0.2; ml = 5 + Math.random() * 3;
        sx = 1.2; sy = 0.2; sz = 1.2;
      } else if (this.weatherType === 'rain') {
        mat = this.weatherMatRain;
        px = (Math.random() - 0.5) * 25; py = 10 + Math.random() * 5; pz = (Math.random() - 0.5) * 25;
        vx = 0.5; vy = -15 - Math.random() * 5; vz = 0;
        grav = 0; ml = 0.8 + Math.random() * 0.5;
        sx = 0.2; sy = 6.0; sz = 0.2;
      } else if (this.weatherType === 'embers') {
        mat = this.weatherMatEmber;
        px = (Math.random() - 0.5) * 20; py = -2 + Math.random() * 2; pz = (Math.random() - 0.5) * 20;
        vx = (Math.random() - 0.5) * 1.5; vy = 1 + Math.random() * 2; vz = (Math.random() - 0.5) * 1.5;
        grav = 0.5; ml = 3 + Math.random() * 2;
        sx = 0.6; sy = 0.6; sz = 0.6;
      }

      if (mat) {
        const m = new THREE.Mesh(this.particleGeo, mat);
        m.position.set(px, py, pz);
        m.scale.set(sx, sy, sz);
        m.userData = { vel: new THREE.Vector3(vx, vy, vz), life: 0, maxLife: ml, gravity: grav };
        this.scene.add(m);
        this.particles.push(m);
      }
    }

    /* Fireworks (Confetti) */
    if (this.fireworksOn) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: this.fwColor, transparent: true });
        const m = new THREE.Mesh(this.particleGeo, mat);
        m.position.set((Math.random() - 0.5) * 16, 8 + Math.random() * 4, (Math.random() - 0.5) * 16);
        m.userData = {
          vel: new THREE.Vector3((Math.random() - 0.5) * 4, -1 - Math.random() * 2, (Math.random() - 0.5) * 4),
          life: 0,
          maxLife: 3 + Math.random() * 2,
          gravity: -2
        };
        const s = 1.0 + Math.random();
        m.scale.set(s, s, s);
        this.scene.add(m);
        this.particles.push(m);
      }
    }

    /* Atualizar partículas */
    if (this.particles.length === 0) return;
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.userData.life += dt;
      const t = p.userData.life;
      if (t >= p.userData.maxLife) {
        this.scene.remove(p);
        p.material.dispose();
        continue;
      }
      const vel = p.userData.vel;
      p.position.x += vel.x * dt;
      p.position.y += vel.y * dt;
      p.position.z += vel.z * dt;
      const g = p.userData.gravity !== undefined ? p.userData.gravity : -15;
      vel.y += g * dt;
      const alpha = 1 - (t / p.userData.maxLife);
      p.material.opacity = alpha;
      p.rotation.x += dt * 4;
      p.rotation.z += dt * 3;
      const s = alpha * (p.userData.isCrown ? 1.5 : 1);
      p.scale.set(s, s, s);
      this.particles[writeIdx++] = p;
    }
    this.particles.length = writeIdx;
  }
}
