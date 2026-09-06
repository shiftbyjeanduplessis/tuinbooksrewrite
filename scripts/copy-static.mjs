import { cp, copyFile, mkdir, writeFile } from 'node:fs/promises';

async function copyAppTree(dir, htmlFile) {
  await mkdir(dir, { recursive: true });
  await mkdir(`${dir}/vendor`, { recursive: true });
  await copyFile(htmlFile, `${dir}/index.html`);
  await copyFile('src/styles.css', `${dir}/styles.css`);
  await copyFile('public/tuinbooks-logo.png', `${dir}/tuinbooks-logo.png`);
  await copyFile('public/vendor/supabase.min.js', `${dir}/vendor/supabase.min.js`);
  await cp('dist/assets', `${dir}/assets`, { recursive: true });
}

// TypeScript emits dist/assets first. Build the production-compatible route tree
// expected by TuinBooks links: /app/ and /management/.
await copyAppTree('dist/app', 'index.html');
await copyFile('mobile.html', 'dist/app/mobile.html');
await copyFile('accept.html', 'dist/app/accept.html');
await copyFile('document.html', 'dist/app/document.html');

await copyAppTree('dist/management', 'management.html');

await writeFile('dist/index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/app/"><title>TuinBooks</title></head><body><p><a href="/app/">Open TuinBooks</a></p></body></html>\n`);
console.log('TuinBooks v2 production route tree copied: /app/ + /management/.');
