/* ============================================================
   DAMAS 3D — Configuração da Cena Three.js
   Renderer, câmera, luzes, ambiente — Otimizado para 60fps
   ============================================================ */

import * as THREE from 'three';

export function createScene(canvas) {
  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

  /* ===== LUZES (melhoradas) ===== */
  const hemi = new THREE.HemisphereLight(0xCFE0FF, 0x1A1410, 0.6);
  scene.add(hemi);

  /* Sol principal — sombras suaves */
  const sun = new THREE.DirectionalLight(0xFFF2DC, 1.3);
  sun.position.set(6, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);

  /* Luz de preenchimento quente */
  const fill = new THREE.PointLight(0xFFD9A0, 0.4, 40);
  fill.position.set(-7, 6, -7);
  scene.add(fill);

  /* Contra-luz fria para profundidade */
  const rim = new THREE.PointLight(0x8FB4FF, 0.2, 30);
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

  return { scene, camera, renderer, materials, resize };
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
