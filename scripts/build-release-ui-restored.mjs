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

await copyAppTree('dist/app', 'index.html');
await copyFile('mobile.html', 'dist/app/mobile.html');
await copyFile('accept.html', 'dist/app/accept.html');
await copyFile('document.html', 'dist/app/document.html');

// Preserve the established TuinBooks Management product instead of the stripped v2 shell.
await mkdir('dist/management', { recursive: true });
await copyFile('original-ui/management/index.html', 'dist/management/index.html');
await copyFile('original-ui/management/management.css', 'dist/management/management.css');
await copyFile('original-ui/management/management.js', 'dist/management/management.js');
await copyFile('original-ui/management/VERSION.txt', 'dist/management/VERSION.txt');
await cp('dist/assets', 'dist/management/assets', { recursive: true });

// Original Management references these app-level Supabase files.
await copyFile('original-ui/app/supabase-config.js', 'dist/app/supabase-config.js');
await mkdir('dist/app/vendor', { recursive: true });
await copyFile('original-ui/app/vendor/supabase.js', 'dist/app/vendor/supabase.js');

await writeFile('dist/index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/app/"><title>TuinBooks</title></head><body><p><a href="/app/">Open TuinBooks</a></p></body></html>\n`);
console.log('TUINBOOKS UI-RESTORED RELEASE R15: visit detail retained + Do Not Service made directly reversible published to /management/ + /app/.');
