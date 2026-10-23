// Serves a game's web build so Luka can play it:  node tools/serve.mjs <game folder> [port]
import { join, resolve } from 'node:path';
import { serve } from './web.mjs';

const dir = join(resolve(process.argv[2] || '.'), 'export', 'web');
const server = await serve(dir, Number(process.argv[3]) || 8061);
// The address carries a random path token (web.mjs serve()): only who has the link can load the game.
console.log(`Playing ${dir}\nOpen ${server.base}/index.html  (Ctrl+C to stop)`);
