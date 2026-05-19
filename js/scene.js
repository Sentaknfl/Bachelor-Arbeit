import * as THREE from 'three';

/**
 * Creates the Three.js renderer, scene, camera, and lights.
 * Does not call setSize — caller must invoke handleResize once after creation.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, clock: THREE.Clock }}
 */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
  camera.position.set(0, 0, 35);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);
  // Exponential fog creates a natural depth cue — cards fade at canvas edges
  scene.fog = new THREE.FogExp2(0x0a0a12, 0.012);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 8, 10);
  scene.add(ambient, dirLight);

  const clock = new THREE.Clock();
  return { renderer, scene, camera, clock };
}

/**
 * Updates renderer size and camera aspect to match the current window.
 * Re-applies the pixel ratio cap in case it changed (some Android browsers do this).
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 */
export function handleResize(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
