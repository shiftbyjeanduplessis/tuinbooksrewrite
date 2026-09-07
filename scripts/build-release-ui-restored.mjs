import { cp, copyFile, mkdir, writeFile } from 'node:fs/promises';

async function copyRewriteTree(dir, htmlFile) {
  await mkdir(dir, { recursive: true });
  await mkdir(`${dir}/vendor`, { recursive: true });
  await copyFile(htmlFile, `${dir}/index.html`);
  await copyFile('src/styles.css', `${dir}/styles.css`);
  await copyFile('public/tuinbooks-logo.png', `${dir}/tuinbooks-logo.png`);
  await copyFile('public/vendor/supabase.min.js', `${dir}/vendor/supabase.min.js`);
  await cp('dist/assets', `${dir}/assets`, { recursive: true });
}

// R19: keep the established office product as /app; repair only Settings icon + Business control.
// Do not rebuild its presentation from the stripped rewrite shell.
await mkdir('dist/app', { recursive: true });
await cp('original-ui/app', 'dist/app', { recursive: true });

// Keep the TypeScript rewrite intact, but isolate it from production UI authority
// until feature-by-feature parity is verified. This prevents another bare-shell cutover.
await copyRewriteTree('dist/rewrite', 'index.html');
await copyFile('mobile.html', 'dist/rewrite/mobile.html');
await copyFile('accept.html', 'dist/rewrite/accept.html');
await copyFile('document.html', 'dist/rewrite/document.html');

// Preserve established Management exactly.
await mkdir('dist/management', { recursive: true });
await copyFile('original-ui/management/index.html', 'dist/management/index.html');
await copyFile('original-ui/management/management.css', 'dist/management/management.css');
await copyFile('original-ui/management/management.js', 'dist/management/management.js');
await copyFile('original-ui/management/VERSION.txt', 'dist/management/VERSION.txt');

await writeFile('dist/index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/app/"><title>TuinBooks</title></head><body><p><a href="/app/">Open TuinBooks</a></p></body></html>\n`);
console.log('TUINBOOKS UI-RESTORED RELEASE R19: Settings icon + Business control repaired on full established office UI.');
