const fs = require('fs');

const url  = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON;

if (!url || !anon) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON environment variables');
  process.exit(1);
}

fs.writeFileSync(
  'js/config.js',
  `export const SUPABASE_URL  = '${url}';\nexport const SUPABASE_ANON = '${anon}';\n`
);

console.log('config.js generated');
