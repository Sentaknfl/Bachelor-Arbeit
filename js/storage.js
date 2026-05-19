const DB_NAME    = 'canvas-cards';
const DB_VERSION = 1;
const STORE      = 'cards';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/**
 * Persists a user card. imageBlob is stored as a Blob so it survives page reloads.
 * @param {{ id, title, note, accentColor, position }} cardData
 * @param {Blob} imageBlob  the original File/Blob from the file picker
 */
export async function saveCard(cardData, imageBlob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: cardData.id,
      title: cardData.title,
      note: cardData.note,
      accentColor: cardData.accentColor,
      position: cardData.position,
      imageBlob,
    });
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

/**
 * Loads all persisted cards and returns them with fresh object URLs for this session.
 * @returns {Promise<Array>}
 */
export async function loadAllCards() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = e => resolve(
      e.target.result.map(r => ({
        ...r,
        imageUrl:    URL.createObjectURL(r.imageBlob),
        fallbackUrl: '/assets/placeholders/fallback.svg',
      }))
    );
    req.onerror = e => reject(e.target.error);
  });
}

/**
 * Removes a card from storage by id.
 * @param {number} id
 */
export async function deleteCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}
