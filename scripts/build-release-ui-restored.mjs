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

// R21 production authority correction.
// /app is the TypeScript rewrite runtime with the restored TuinBooks visual shell.
// original-ui/app remains reference material only and MUST NOT become the active runtime.
await copyAppTree('dist/app', 'index.html');
await copyFile('mobile.html', 'dist/app/mobile.html');
await copyFile('accept.html', 'dist/app/accept.html');
await copyFile('document.html', 'dist/app/document.html');

// Keep /rewrite as a non-authoritative diagnostic alias of the same rewrite build.
await copyAppTree('dist/rewrite', 'index.html');
await copyFile('mobile.html', 'dist/rewrite/mobile.html');
await copyFile('accept.html', 'dist/rewrite/accept.html');
await copyFile('document.html', 'dist/rewrite/document.html');

// Management remains the established Management product, with the R20 absolute-path fix.
await mkdir('dist/management', { recursive: true });
await copyFile('original-ui/management/index.html', 'dist/management/index.html');
await copyFile('original-ui/management/management.css', 'dist/management/management.css');
await copyFile('original-ui/management/management.js', 'dist/management/management.js');
await copyFile('original-ui/management/VERSION.txt', 'dist/management/VERSION.txt');

// Established Management references these app-level Supabase browser files.
await copyFile('original-ui/app/supabase-config.js', 'dist/app/supabase-config.js');
await mkdir('dist/app/vendor', { recursive: true });
await copyFile('original-ui/app/vendor/supabase.js', 'dist/app/vendor/supabase.js');

await writeFile('dist/index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/app/"><title>TuinBooks</title></head><body><p><a href="/app/">Open TuinBooks</a></p></body></html>\n`);
console.log('TUINBOOKS RELEASE R26: Schedule mutations now re-sync silently without blanking the calendar; R25 Basket persistence/multi-select, R24 blockers and R23 Schedule polish preserved; legacy app engine inactive.');
