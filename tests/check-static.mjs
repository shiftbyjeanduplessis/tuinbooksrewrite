import { readdir, readFile, access } from 'node:fs/promises';
import { join,dirname,resolve } from 'node:path';
async function walk(d){let out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())out=out.concat(await walk(p));else out.push(p);}return out;}
const files=(await walk('dist/app/assets')).filter(f=>f.endsWith('.js'));
let imports=0,missing=[];for(const f of files){const s=await readFile(f,'utf8');for(const m of s.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){imports++;let p=resolve(dirname(f),m[1]);try{await access(p);}catch{missing.push(`${f} -> ${m[1]}`);}}}
if(missing.length)throw new Error(`Missing active rewrite imports:\n${missing.join('\n')}`);
const joined=(await Promise.all(files.map(f=>readFile(f,'utf8')))).join('\n');
for(const forbidden of ['serviceSitesV56','schedule-exact-canary','schedule-drag-mode-v6061','schedule-drag-basket-v6066','MutationObserver','scrollIntoView','setInterval('])if(joined.includes(forbidden))throw new Error(`Forbidden active runtime pattern present: ${forbidden}`);
for(const required of ['dist/app/index.html','dist/app/styles.css','dist/app/mobile.html','dist/app/assets/app.js','dist/app/supabase-config.js','dist/app/vendor/supabase.js','dist/management/index.html','dist/management/management.css','dist/management/management.js','dist/index.html','dist/rewrite/index.html','dist/rewrite/assets/app.js'])await access(required);
try{await access('dist/app/app.js');throw new Error('Legacy app.js must not be published as active /app runtime');}catch(error){if(error?.message==='Legacy app.js must not be published as active /app runtime')throw error;}
const appHtml=await readFile('dist/app/index.html','utf8');
for(const marker of ['id="root"','./styles.css','./assets/app.js'])if(!appHtml.includes(marker))throw new Error(`Active rewrite shell missing ${marker}`);
const styles=await readFile('dist/app/styles.css','utf8');
if(styles.length<20000)throw new Error(`Restored TuinBooks stylesheet is unexpectedly small (${styles.length} bytes)`);
for(const marker of ['ORIGINAL TUINBOOKS UI AUTHORITY','.admin-header','.header-settings-button','.visit-location'])if(!styles.includes(marker))throw new Error(`Restored active styling missing ${marker}`);
const mgmt=await readFile('dist/management/index.html','utf8');
for(const marker of ['/management/management.css?v=R20-management-path-fix','/management/management.js?v=R20-management-path-fix','/app/supabase-config.js','/app/vendor/supabase.js'])if(!mgmt.includes(marker))throw new Error(`Management R20 routing marker missing ${marker}`);
console.log(`TUINBOOKS R21 STATIC: PASS · rewrite active at /app · legacy app.js inactive · restored visual shell present · ${files.length} modules · ${imports} relative imports · 0 missing`);
