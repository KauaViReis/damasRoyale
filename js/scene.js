/* ============================================================
   DAMAS 3D — Configuração da Cena Three.js
   Renderer, câmera, luzes, ambiente — Otimizado para 60fps
   ============================================================ */

import * as THREE from 'three';

export function detectHardwareTier(renderer) {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'low';
    }
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const isMobile = (navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 900;

    let gpu = '';
    if (renderer) {
      const gl = renderer.getContext();
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) gpu = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    }
    if (/swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [234]/.test(gpu)) {
      return 'low';
    }
    if (mem <= 2 || cores <= 2) return 'low';
    if (isMobile || mem <= 4 || cores <= 4 || /intel\(r\) (hd|uhd) graphics/.test(gpu)) {
      return 'medium';
    }
    return 'high';
  } catch {
    return 'medium';
  }
}

export function applyQualityTier(tier, { renderer, lights, fx }) {
  const dpr = window.devicePixelRatio || 1;
  const sun = lights && lights.sun;
  const fill = lights && lights.fill;
  const rim = lights && lights.rim;

  if (tier === 'high') {
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.shadowMap.enabled = true;
    if (sun) {
      sun.castShadow = true;
      if (sun.shadow.mapSize.x !== 2048) {
        sun.shadow.mapSize.set(2048, 2048);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    if (fill) fill.intensity = 0.4;
    if (rim) rim.intensity = 0.2;
  } else if (tier === 'medium') {
    renderer.setPixelRatio(Math.min(dpr, 1.5));
    renderer.shadowMap.enabled = true;
    if (sun) {
      sun.castShadow = true;
      if (sun.shadow.mapSize.x !== 1024) {
        sun.shadow.mapSize.set(1024, 1024);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    if (fill) fill.intensity = 0.35;
    if (rim) rim.intensity = 0;
  } else {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    if (sun) sun.castShadow = false;
    if (fill) fill.intensity = 0;
    if (rim) rim.intensity = 0;
  }

  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (fx && typeof fx.setQuality === 'function') fx.setQuality(tier);
}

export function createScene(canvas) {
  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const qualityTier = detectHardwareTier(renderer);
  renderer.setPixelRatio(qualityTier === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, qualityTier === 'medium' ? 1.5 : 2));
  renderer.shadowMap.enabled = qualityTier !== 'low';
  renderer.shadowMap.type = qualityTier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  /* Cena */
  const scene = new THREE.Scene();

  /* Câmera */
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  /* Ambiente para reflexos (environment map) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1a1c22);
  const mkPlane = (color, x, y, z, sx, sy) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sy),
      new THREE.MeshBasicMaterial({ color })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  mkPlane(0xffffff, 0, 10, 0, 14, 14);
  mkPlane(0xE3A94E, -10, 4, 6, 8, 6);
  mkPlane(0x8FB4FF, 10, 3, -6, 8, 6);
  scene.environment = pmrem.fromScene(envScene, 0.05).texture;
  pmrem.dispose();

  /* ===== LUZES (adaptativas por tier) ===== */
  const hemi = new THREE.HemisphereLight(0xCFE0FF, 0x1A1410, 0.65);
  scene.add(hemi);

  /* Sol principal — sombras suaves */
  const sun = new THREE.DirectionalLight(0xFFF2DC, 1.3);
  sun.position.set(6, 12, 5);
  sun.castShadow = qualityTier !== 'low';
  const smSize = qualityTier === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(smSize, smSize);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = qualityTier === 'high' ? 4 : 2;
  scene.add(sun);

  /* Luz de preenchimento quente */
  const fill = new THREE.PointLight(0xFFD9A0, qualityTier === 'low' ? 0 : 0.4, 40);
  fill.position.set(-7, 6, -7);
  scene.add(fill);

  /* Contra-luz fria para profundidade */
  const rim = new THREE.PointLight(0x8FB4FF, qualityTier === 'high' ? 0.2 : 0, 30);
  rim.position.set(5, 4, -8);
  scene.add(rim);

  /* ===== MATERIAIS ===== */
  const materials = {
    lightSq: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
    darkSq:  new THREE.MeshStandardMaterial({ roughness: 0.5,  metalness: 0.08 }),
    frame:   new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15 }),
    table:   new THREE.MeshStandardMaterial({ roughness: 0.7,  metalness: 0.05 }),
    gold:    new THREE.MeshPhysicalMaterial({
      color: 0xD9AC3C, roughness: 0.28, metalness: 0.95,
      clearcoat: 0.6, emissive: 0xD9AC3C, emissiveIntensity: 0.12
    }),
  };

  /* Helpers */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, renderer, materials, lights: { hemi, sun, fill, rim }, qualityTier, resize };
}

/* Pós-processamento opcional (FASE 9): Bloom sutil.
   Carregado sob demanda para não pesar em dispositivos fracos. */
export async function createComposer(renderer, scene, camera) {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
    await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js')
    ]);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.32,  /* intensidade */
    0.55,  /* raio */
    0.82   /* limiar — só os destaques brilham */
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return composer;
}
