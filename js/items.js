import * as THREE from 'three';
import { getPositionedData } from './data.js';

/**
 * Draws word-wrapped text onto a canvas 2D context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @param {number} maxLines
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const words = text.split(' ');
  let line = '';
  let drawn = 0;

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + ' ';
      y += lineHeight;
      drawn++;
      if (drawn >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (drawn < maxLines) ctx.fillText(line.trim(), x, y);
}

/**
 * Renders title + note text onto an offscreen canvas and returns it as a texture.
 * CanvasTexture keeps everything in the WebGL scene — no CSS3DRenderer depth issues.
 * Canvas is 512×256 (power-of-two width, within the 1024px budget).
 * @param {string} noteText
 * @param {string} title
 * @param {string} accentColor  hex string
 * @returns {THREE.CanvasTexture}
 */
function makeNoteTexture(noteText, title, accentColor) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // Background
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 0, W, H);

  // Accent top border — colour-coded per card
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, W, 4);

  // Title
  ctx.font = "bold 22px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, 24, 42);

  // Hairline divider
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(24, 55, W - 48, 1);

  // Body text with word-wrap
  ctx.font = "15px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = '#c8c8d4';
  wrapText(ctx, noteText, 24, 82, W - 48, 22, 5);

  const texture = new THREE.CanvasTexture(cv);
  texture.needsUpdate = true;
  return texture;
}

/**
 * @param {string} imageUrl
 * @param {string} fallbackUrl
 * @param {THREE.LoadingManager} loadingManager
 * @param {number} w  world units
 * @param {number} h  world units
 * @returns {THREE.Mesh}
 */
function makeImageMesh(imageUrl, fallbackUrl, loadingManager, w = 3.2, h = 2.4) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'image';

  const loader = new THREE.TextureLoader(loadingManager);
  loader.load(
    imageUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;   // sharper at oblique angles without large cost
      mat.map = tex;
      mat.needsUpdate = true;
    },
    undefined,
    () => {
      // On error, swap in the local fallback SVG
      loader.load(fallbackUrl, (tex) => { mat.map = tex; mat.needsUpdate = true; });
    },
  );

  return mesh;
}

/**
 * @param {string} noteText
 * @param {string} title
 * @param {string} accentColor
 * @param {number} w
 * @param {number} h
 * @returns {THREE.Mesh}
 */
function makeNoteMesh(noteText, title, accentColor, w = 3.2, h = 1.6) {
  const geo = new THREE.PlaneGeometry(w, h);
  const tex = makeNoteTexture(noteText, title, accentColor);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'note';
  return mesh;
}

/**
 * Assembles one card: image plane + note plane + dark backing plane.
 * All children share the group's billboard quaternion from the render loop.
 * @param {object} cardData  entry from getPositionedData()
 * @param {THREE.LoadingManager} loadingManager
 * @returns {THREE.Group}
 */
export function makeCardGroup(cardData, loadingManager) {
  const group = new THREE.Group();

  const imgMesh = makeImageMesh(cardData.imageUrl, cardData.fallbackUrl, loadingManager);
  imgMesh.position.y = 0.9;

  const noteMesh = makeNoteMesh(cardData.note, cardData.title, cardData.accentColor);
  noteMesh.position.y = -0.9;

  // Backing plane — shows only from behind via BackSide, frames the card edges
  const backMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 4.2),
    new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.BackSide }),
  );
  backMesh.position.z = -0.01;
  backMesh.name = 'back';

  group.add(imgMesh, noteMesh, backMesh);
  group.position.set(cardData.position.x, cardData.position.y, cardData.position.z);
  group.name = `card_${cardData.id}`;
  group.userData = {
    id: cardData.id,
    title: cardData.title,
    note: cardData.note,
    imageUrl: cardData.imageUrl,
    accentColor: cardData.accentColor,
    targetScale: 1,
    isSelected: false,
  };

  return group;
}

/**
 * Creates all 10 card groups and the flat mesh list used for raycasting.
 * @param {THREE.LoadingManager} loadingManager
 * @returns {{ cardGroups: THREE.Group[], raycasterMeshes: THREE.Mesh[] }}
 */
export function createAllCards(loadingManager) {
  const data = getPositionedData();
  const cardGroups = data.map(d => makeCardGroup(d, loadingManager));
  // Flat list of image+note meshes — backing planes excluded from raycasting
  const raycasterMeshes = cardGroups.flatMap(g =>
    g.children.filter(c => c.name === 'image' || c.name === 'note')
  );
  return { cardGroups, raycasterMeshes };
}
