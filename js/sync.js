import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

let supabase;

/**
 * Initialises the Supabase client and subscribes to realtime card inserts.
 * @param {(cardData: object) => void} onRemoteCard  called for each card inserted by another client
 */
export function initSync(onRemoteCard) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

  supabase
    .channel('public:cards')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' },
      payload => onRemoteCard(rowToCard(payload.new))
    )
    .subscribe();
}

/**
 * Fetches all cards from the database, ordered by creation time.
 * @returns {Promise<object[]>}
 */
export async function fetchAllCards() {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data.map(rowToCard);
}

/**
 * Uploads the image to Storage then inserts a row to the cards table.
 * The realtime channel will broadcast the insert to all connected clients.
 * @param {object} cardData
 * @param {File}   imageFile
 */
export async function uploadCard(cardData, imageFile) {
  const ext  = imageFile.name.split('.').pop().toLowerCase() || 'jpg';
  const path = `${cardData.id}.${ext}`;

  const { error: storageError } = await supabase.storage
    .from('card-images')
    .upload(path, imageFile, { upsert: false });
  if (storageError) throw storageError;

  const { data: { publicUrl } } = supabase.storage
    .from('card-images')
    .getPublicUrl(path);

  const { error: dbError } = await supabase.from('cards').insert({
    id:           cardData.id,
    title:        cardData.title,
    note:         cardData.note,
    accent_color: cardData.accentColor,
    position_x:   cardData.position.x,
    position_y:   cardData.position.y,
    position_z:   cardData.position.z,
    image_url:    publicUrl,
  });
  if (dbError) throw dbError;
}

/** Maps a database row to the cardData shape the canvas expects. */
function rowToCard(row) {
  return {
    id:          row.id,
    title:       row.title,
    note:        row.note,
    accentColor: row.accent_color,
    position:    { x: row.position_x, y: row.position_y, z: row.position_z },
    imageUrl:    row.image_url,
    fallbackUrl: '/assets/placeholders/fallback.svg',
  };
}
