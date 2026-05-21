import * as THREE from 'three';
import { createScene, handleResize } from './scene.js';
import { createControls } from './controls.js';
import { createAllCards, makeCardGroup } from './items.js';
import { initSync, fetchAllCards, uploadCard } from './sync.js';

// ── Module state ──────────────────────────────────────────────────────────────
let renderer, scene, camera, controls;
let cardGroups = [];
let raycasterMeshes = [];
let hoveredGroup   = null;
let selectedGroup  = null;

const raycaster      = new THREE.Raycaster();
const pointer        = new THREE.Vector2(-9999, -9999);
let pointerDownPos   = { x: 0, y: 0 };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas          = document.getElementById('canvas');
const tooltip         = document.getElementById('card-tooltip');
const srStatus        = document.getElementById('sr-status');
const loadingText     = document.getElementById('loading-text');
const loadingOverlay  = document.getElementById('loading-overlay');
const modal           = document.getElementById('modal');
const modalBackdrop   = document.getElementById('modal-backdrop');
const modalClose      = document.getElementById('modal-close');
const modalImg        = document.getElementById('modal-img');
const modalAccentBar  = document.getElementById('modal-accent-bar');
const modalTitle      = document.getElementById('modal-title');
const modalNote       = document.getElementById('modal-note');
const btnAdd          = document.getElementById('btn-add');
const uploadModal     = document.getElementById('upload-modal');
const uploadBackdrop  = document.getElementById('upload-backdrop');
const uploadClose     = document.getElementById('upload-close');
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const uploadPreview   = document.getElementById('upload-preview');
const uploadTitle     = document.getElementById('upload-title');
const uploadNote      = document.getElementById('upload-note');
const noteCounter     = document.getElementById('note-counter');
const uploadSubmit    = document.getElementById('upload-submit');

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  const loadingManager = new THREE.LoadingManager(onLoad, onProgress, onError);

  ({ renderer, scene, camera } = createScene(canvas));
  handleResize(renderer, camera);

  ({ controls } = createControls(camera, canvas));

  const result = createAllCards(loadingManager);
  cardGroups       = result.cardGroups;
  raycasterMeshes  = result.raycasterMeshes;
  cardGroups.forEach(g => scene.add(g));

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup',   onPointerUp);
  window.addEventListener('resize', onResize);
  // iOS address-bar collapse changes visual viewport but not window.innerHeight immediately
  window.visualViewport?.addEventListener('resize', onResize);
  modalBackdrop.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);

  btnAdd.addEventListener('click', openUploadModal);
  uploadBackdrop.addEventListener('click', closeUploadModal);
  uploadClose.addEventListener('click', closeUploadModal);
  // Label's native for/child association handles click → input on all devices.
  // Explicit keydown only needed for keyboard users (labels don't handle Enter/Space by default).
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', e => handleFileSelect(e.target.files[0]));
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files[0]);
  });
  uploadNote.addEventListener('input', () => {
    const len = uploadNote.value.length;
    noteCounter.textContent = `${len} / 250`;
    noteCounter.classList.toggle('near-limit', len >= 220);
    validateUpload();
  });
  uploadTitle.addEventListener('input', validateUpload);
  uploadSubmit.addEventListener('click', submitCard);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !uploadModal.hidden) closeUploadModal(); });

  renderer.setAnimationLoop(renderLoop);

  // Set up Supabase realtime — new cards from any client appear automatically
  initSync(onRemoteCard);
  // Load all existing cards from Supabase (canvas renders immediately regardless)
  loadRemoteCards();

  window.__app = { camera, controls, scene };
}

/** Adds a card to the canvas, skipping duplicates (guards against realtime + fetch races). */
function addCardToCanvas(cardData) {
  if (cardGroups.some(g => g.userData.id === cardData.id)) return;
  const group = makeCardGroup(cardData, undefined);
  scene.add(group);
  cardGroups.push(group);
  raycasterMeshes.push(...group.children.filter(c => c.name === 'image' || c.name === 'note'));
}

function onRemoteCard(cardData) {
  addCardToCanvas(cardData);
}

async function loadRemoteCards() {
  try {
    const cards = await fetchAllCards();
    cards.forEach(addCardToCanvas);
  } catch (err) {
    console.warn('[canvas] could not load cards from Supabase:', err);
  }
}

// ── LoadingManager callbacks ──────────────────────────────────────────────────
function onLoad() {
  loadingOverlay.classList.add('hidden');
}

function onProgress(_url, loaded, total) {
  if (loadingText) loadingText.textContent = `Loading… ${loaded} / ${total}`;
}

function onError(url) {
  console.warn('[canvas] texture failed:', url);
}

// ── Render loop ───────────────────────────────────────────────────────────────
// Order: controls → billboard → hover → scale lerp → render
function renderLoop() {
  controls.update();   // must be called every frame for damping to work

  // Billboard: cards always face the camera
  for (const g of cardGroups) g.quaternion.copy(camera.quaternion);

  // Raycaster hover — desktop (pointer: fine) only; touch uses tap events instead
  if (!isTouchDevice()) updateHover();

  // Smooth scale animation toward targetScale
  for (const g of cardGroups) {
    const target = g.userData.targetScale ?? 1;
    const cur    = g.scale.x;
    if (Math.abs(cur - target) > 0.001) {
      g.scale.setScalar(THREE.MathUtils.lerp(cur, target, 0.12));
    }
  }

  renderer.render(scene, camera);
}

// ── Hover (desktop only) ──────────────────────────────────────────────────────
function updateHover() {
  raycaster.setFromCamera(pointer, camera);
  const hits     = raycaster.intersectObjects(raycasterMeshes, false);
  const hitGroup = hits.length > 0 ? hits[0].object.parent : null;

  if (hitGroup !== hoveredGroup) {
    if (hoveredGroup && hoveredGroup !== selectedGroup) onHoverLeave(hoveredGroup);
    else if (hoveredGroup) canvas.style.cursor = '';   // was selected, just clear cursor
    if (hitGroup) onHoverEnter(hitGroup);
    hoveredGroup = hitGroup;
  }

  if (hitGroup && !selectedGroup) {
    // Position tooltip at projected world-space centre of the hovered mesh
    const wp = new THREE.Vector3();
    hits[0].object.getWorldPosition(wp);
    wp.project(camera);
    const sx = ( wp.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-wp.y * 0.5 + 0.5) * window.innerHeight;
    tooltip.style.left = `${sx}px`;
    tooltip.style.top  = `${sy}px`;
    tooltip.textContent = hitGroup.userData.title;
    tooltip.classList.add('visible');
  } else if (!hitGroup && !selectedGroup) {
    tooltip.classList.remove('visible');
  }
}

function onHoverEnter(group) {
  if (!group.userData.isSelected) group.userData.targetScale = 1.05;
  canvas.style.cursor = 'pointer';
}

function onHoverLeave(group) {
  group.userData.targetScale = group.userData.isSelected ? 1.1 : 1.0;
  canvas.style.cursor = '';
}

// ── Pointer events ────────────────────────────────────────────────────────────
function onPointerMove(e) {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e) {
  // Ignore drags — only fire select for genuine taps / clicks
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.hypot(dx, dy) > 8) return;
  selectAtPointer(e.clientX, e.clientY);
}

function selectAtPointer(clientX, clientY) {
  const ndcX =  (clientX / window.innerWidth)  * 2 - 1;
  const ndcY = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  // Force world-matrix update in case this fires outside the render loop
  scene.updateMatrixWorld();
  const hits = raycaster.intersectObjects(raycasterMeshes, false);
  if (hits.length > 0) {
    onSelect(hits[0].object.parent);
  } else if (selectedGroup) {
    onDeselect(selectedGroup);
  }
}

// ── Select / deselect ─────────────────────────────────────────────────────────
function onSelect(group) {
  if (group === selectedGroup) { closeModal(); return; }  // toggle
  if (selectedGroup) onDeselect(selectedGroup);

  group.userData.isSelected = true;
  group.userData.targetScale = 1.1;
  setEmissive(group, group.userData.accentColor, 0.15);
  selectedGroup = group;

  tooltip.classList.remove('visible');
  openModal(group);
}

function onDeselect(group) {
  group.userData.isSelected = false;
  group.userData.targetScale = (group === hoveredGroup) ? 1.05 : 1.0;
  setEmissive(group, '#000000', 0);
  selectedGroup = null;
  srStatus.textContent = 'Deselected';
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(group) {
  const { title, note, imageUrl, accentColor } = group.userData;
  modalImg.src                  = imageUrl;
  modalImg.alt                  = title;
  modalTitle.textContent        = title;
  modalNote.textContent         = note;
  modalAccentBar.style.background = accentColor;
  modal.hidden = false;
  document.addEventListener('keydown', onModalKeyDown);
  // Move focus into modal for keyboard / screen-reader users
  modalClose.focus();
  srStatus.textContent = `Opened: ${title}. ${note}`;
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  document.removeEventListener('keydown', onModalKeyDown);
  if (selectedGroup) onDeselect(selectedGroup);
  canvas.focus();
}

function onModalKeyDown(e) {
  if (e.key === 'Escape') closeModal();
}

/** Applies emissive colour to all MeshStandardMaterial children of a group. */
function setEmissive(group, colorHex, intensity) {
  group.traverse(child => {
    if (child.isMesh && child.material?.isMeshStandardMaterial) {
      child.material.emissive.set(colorHex);
      child.material.emissiveIntensity = intensity;
    }
  });
}

// ── Upload / add card ─────────────────────────────────────────────────────────
let uploadedObjectUrl = null;
let uploadedFile      = null;

function openUploadModal() {
  uploadModal.hidden = false;
  uploadTitle.focus();
}

function closeUploadModal() {
  // Blur first — Firefox zooms out when focus leaves the input.
  // If we hide the modal while an input is focused, Firefox never gets the signal to zoom out.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  uploadModal.hidden = true;
  resetUploadForm();
  resetViewportZoom();
}

/** Snaps the viewport back to scale=1 after an input-focus zoom on mobile browsers. */
function resetViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const original = meta.content;
  // Temporarily clamp scale — Safari resets on next frame, Firefox on the setTimeout tick.
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
  requestAnimationFrame(() => {
    meta.content = original;
    window.scrollTo(0, 0); // belt-and-suspenders for Firefox
  });
}

function resetUploadForm() {
  if (uploadedObjectUrl) { URL.revokeObjectURL(uploadedObjectUrl); uploadedObjectUrl = null; }
  uploadedFile = null;
  fileInput.value = '';
  uploadTitle.value = '';
  uploadNote.value = '';
  noteCounter.textContent = '0 / 250';
  noteCounter.classList.remove('near-limit');
  dropZone.classList.remove('has-image');
  uploadPreview.hidden = true;
  uploadPreview.src = '';
  uploadSubmit.disabled = true;
}

function validateUpload() {
  uploadSubmit.disabled = !uploadedObjectUrl || uploadNote.value.trim().length === 0;
}

function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (uploadedObjectUrl) URL.revokeObjectURL(uploadedObjectUrl);
  uploadedFile      = file;
  uploadedObjectUrl = URL.createObjectURL(file);
  uploadPreview.src = uploadedObjectUrl;
  uploadPreview.hidden = false;
  dropZone.classList.add('has-image');
  // Default title from filename if field is empty
  if (!uploadTitle.value) uploadTitle.value = file.name.replace(/\.[^.]+$/, '');
  validateUpload();
}

function submitCard() {
  if (!uploadedObjectUrl || !uploadNote.value.trim()) return;

  const cardData = {
    id:          generateId(),
    title:       uploadTitle.value.trim() || 'Untitled',
    note:        uploadNote.value.trim(),
    accentColor: '#ff4400',
    position:    findFreePosition(),
    imageUrl:    uploadedObjectUrl,
    fallbackUrl: '/assets/placeholders/fallback.svg',
  };

  // Optimistic: add to canvas immediately so the uploader sees it right away
  addCardToCanvas(cardData);

  // Null before closeUploadModal so resetUploadForm doesn't revoke the blob URL —
  // the Three.js texture still holds a live reference to it.
  uploadedObjectUrl = null;
  const fileToUpload = uploadedFile;
  uploadedFile = null;
  closeUploadModal();

  // Upload image + insert DB row → realtime broadcasts to all other clients
  uploadCard(cardData, fileToUpload)
    .catch(err => console.warn('[canvas] upload failed:', err));
}

/** Finds an open position in the scene that doesn't overlap existing cards. */
function findFreePosition() {
  const MIN_SEP = 4;
  const existing = cardGroups.map(g => g.position);
  for (let i = 0; i < 100; i++) {
    const r     = Math.random() * 18 + 4;
    const theta = Math.random() * Math.PI;
    const phi   = Math.random() * Math.PI * 2;
    const pos   = {
      x:  r * Math.sin(theta) * Math.cos(phi),
      y:  r * Math.sin(theta) * Math.sin(phi) * 0.55,
      z:  r * Math.cos(theta) * 0.4,
    };
    if (existing.every(p => {
      const dx = p.x - pos.x, dy = p.y - pos.y, dz = p.z - pos.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz) >= MIN_SEP;
    })) return pos;
  }
  return { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 20, z: 0 };
}


// ── Resize ────────────────────────────────────────────────────────────────────
function onResize() {
  handleResize(renderer, camera);
  // Reset pointer so stale NDC coords don't trigger phantom hovers
  pointer.set(-9999, -9999);
  if (hoveredGroup && !hoveredGroup.userData.isSelected) {
    onHoverLeave(hoveredGroup);
    hoveredGroup = null;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function isTouchDevice() {
  return navigator.maxTouchPoints > 0;
}

function generateId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
}

init();
