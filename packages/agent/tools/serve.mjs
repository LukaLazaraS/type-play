// Serves a game's web build so Luka can play it:  node tools/serve.mjs <game folder> [port]
import { join, resolve } from 'node:path';
import { serve } from './web.mjs';

const dir = join(resolve(process.argv[2] || '.'), 'export', 'web');
const server = await serve(dir, Number(process.argv[3]) || 8061);
console.log(`Playing ${dir}\nOpen http://127.0.0.1:${server.address().port}/index.html  (Ctrl+C to stop)`);
