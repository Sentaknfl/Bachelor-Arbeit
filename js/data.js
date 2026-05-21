/**
 * Returns a seeded LCG PRNG producing floats in [0, 1).
 * Numerical Recipes constants; Math.imul prevents float-precision loss.
 * @param {number} seed
 * @returns {() => number}
 */
function lcg(seed = 42) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(1664525, state) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

const TWO_PI = Math.PI * 2;

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Rejection-samples `count` positions in a flat spherical cloud.
 * Z axis compressed ×0.4 so cards spread in the XY plane (reads better).
 * @param {number} count
 * @param {() => number} rng
 * @param {number} minSep  minimum distance between any two cards
 * @returns {{ x: number, y: number, z: number }[]}
 */
function generatePositions(count, rng, minSep = 4) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    let attempts = 0, pos;
    do {
      const r     = rng() * 18 + 4;
      const theta = rng() * Math.PI;
      const phi   = rng() * TWO_PI;
      pos = {
        x:  r * Math.sin(theta) * Math.cos(phi),
        y:  r * Math.sin(theta) * Math.sin(phi) * 0.55,
        z:  r * Math.cos(theta) * 0.4,
      };
      attempts++;
    } while (attempts < 50 && positions.some(p => dist(p, pos) < minSep));
    positions.push(pos);
  }
  return positions;
}

/**
 * Source of truth for all canvas items.
 * Add or modify entries here — no other file needs to change.
 */
export const CARD_DATA = [
  {
    id: 0, title: 'Aurora Studies',
    note: 'Photographed near Tromsø in January. The green bands appeared around 23:00 local time and lasted nearly 40 minutes — unusually long for a KP4 event.',
    imageUrl: 'https://picsum.photos/seed/aurora/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 1, title: 'Circuit Diagrams',
    note: 'Revised the power supply stage for the v3 PCB. Input impedance now matches the sensor array spec within 2%. Needs thermal testing at 85°C.',
    imageUrl: 'https://picsum.photos/seed/circuit/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 2, title: 'Coastal Survey',
    note: 'Drone transect data from the northern headland. 14 sampling points, salinity range 28–34 ppt. Erosion rate approximately 0.8 m per year.',
    imageUrl: 'https://picsum.photos/seed/coast/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 3, title: 'Forest Canopy',
    note: 'LiDAR scan of the old-growth section. Average canopy height 32 m, with four emergent trees exceeding 45 m. Understory density is recovering well.',
    imageUrl: 'https://picsum.photos/seed/forest/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 4, title: 'Nebula Archive',
    note: 'H-alpha composite from 11 hours of integration. The emission region spans roughly 3 parsecs across the widest axis based on Gaia parallax data.',
    imageUrl: 'https://picsum.photos/seed/nebula/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 5, title: 'Desert Basin',
    note: 'Thermal imagery captured at 14:00 local. Surface temperatures reached 67°C on exposed rock. Dry wash channel still retains subsurface moisture.',
    imageUrl: 'https://picsum.photos/seed/desert/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 6, title: 'City Grid',
    note: 'Night exposure, 25-second shutter at f/8. Light pollution index is 7.2 on the Bortle scale. Street grid aligns to magnetic north.',
    imageUrl: 'https://picsum.photos/seed/city/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 7, title: 'Macro World',
    note: 'Scanning electron micrograph of pollen grain, 200× magnification. Apertures average 1.8 μm. Species: Quercus robur — pedunculate oak.',
    imageUrl: 'https://picsum.photos/seed/macro/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 8, title: 'Ocean Trench',
    note: 'Bathymetric model at 50 m contours. The unnamed seamount rises 2,400 m from the abyssal plain, logged in the 2019 survey.',
    imageUrl: 'https://picsum.photos/seed/ocean/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
  {
    id: 9, title: 'Abstract Forms',
    note: 'Procedural geometry study. 512 instanced icosahedra driven by a simplex noise field updated at 24 fps. GPU time: 1.2 ms on RTX 3060.',
    imageUrl: 'https://picsum.photos/seed/abstract/512/384',
    fallbackUrl: '/assets/placeholders/fallback.svg',
    accentColor: '#ff4400',
  },
];

/**
 * Returns CARD_DATA with a deterministic `position` field merged onto each entry.
 * This is the only public API consumers need.
 * @returns {Array<typeof CARD_DATA[0] & { position: {x:number,y:number,z:number} }>}
 */
export function getPositionedData() {
  const rng = lcg(42);
  const positions = generatePositions(CARD_DATA.length, rng, 4);
  return CARD_DATA.map((card, i) => ({ ...card, position: positions[i] }));
}
