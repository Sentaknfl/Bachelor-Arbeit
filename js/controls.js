import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Configures OrbitControls for the 3D canvas.
 * Scoped to the canvas element so touch listeners don't leak to document.
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLCanvasElement} domElement
 * @returns {{ controls: OrbitControls, disposeKeyboard: () => void }}
 */
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);

  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;   // lower = more glide / "space" feel
  controls.screenSpacePanning = true;
  controls.minDistance    = 5;
  controls.maxDistance    = 80;
  controls.rotateSpeed    = 0.7;
  controls.zoomSpeed      = 0.9;
  controls.panSpeed       = 0.8;

  controls.mouseButtons = {
    LEFT:   THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT:  THREE.MOUSE.PAN,
  };

  // 1-finger = rotate, 2-finger = pinch-zoom + pan
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  const disposeKeyboard = addKeyboardControls(controls, camera);
  return { controls, disposeKeyboard };
}

/**
 * Arrow-key pan, +/- zoom, Home reset.
 * Pan speed scales with distance so movement stays proportional at any zoom level.
 * @param {OrbitControls} controls
 * @param {THREE.PerspectiveCamera} camera
 * @returns {() => void} cleanup — removes the keydown listener
 */
function addKeyboardControls(controls, camera) {
  function onKeyDown(e) {
    const panScale = camera.position.distanceTo(controls.target) * 0.03;

    switch (e.key) {
      case '+': case '=': case 'Add':
        camera.position.lerp(controls.target, 0.08);
        break;
      case '-': case 'Subtract':
        // Lerp away from target: negate factor via direction vector
        camera.position.sub(controls.target).multiplyScalar(1.09).add(controls.target);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        controls.target.x -= panScale;
        camera.position.x -= panScale;
        break;
      case 'ArrowRight':
        e.preventDefault();
        controls.target.x += panScale;
        camera.position.x += panScale;
        break;
      case 'ArrowUp':
        e.preventDefault();
        controls.target.y += panScale;
        camera.position.y += panScale;
        break;
      case 'ArrowDown':
        e.preventDefault();
        controls.target.y -= panScale;
        camera.position.y -= panScale;
        break;
      case 'Home':
        camera.position.set(0, 0, 35);
        controls.target.set(0, 0, 0);
        break;
      default:
        return;
    }
    controls.update();
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
