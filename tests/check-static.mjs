import { readdir, readFile, access } from 'node:fs/promises';
import { join,dirname,resolve } from 'node:path';
async function walk(d){let out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())out=out.concat(await walk(p));else out.push(p);}return out;}
// The rewrite remains compiled and statically checked, but is isolated at /rewrite.
const files=(await walk('dist/rewrite/assets')).filter(f=>f.endsWith('.js'));
let imports=0,missing=[];for(const f of files){const s=await readFile(f,'utf8');for(const m of s.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){imports++;let p=resolve(dirname(f),m[1]);try{await access(p);}catch{missing.push(`${f} -> ${m[1]}`);}}}
if(missing.length)throw new Error(`Missing rewrite imports:\n${missing.join('\n')}`);
const joined=(await Promise.all(files.map(f=>readFile(f,'utf8')))).join('\n');
for(const forbidden of ['serviceSitesV56','schedule-exact-canary','schedule-drag-mode-v6061','schedule-drag-basket-v6066','MutationObserver','scrollIntoView','setInterval('])if(joined.includes(forbidden))throw new Error(`Forbidden rewrite/runtime pattern present: ${forbidden}`);
for(const required of ['dist/app/index.html','dist/app/app.js','dist/app/styles.css','dist/app/mobile.html','dist/app/r18-ui-parity-bridge.js','dist/app/service-worker.js','dist/management/index.html','dist/index.html','dist/rewrite/index.html','dist/rewrite/assets/app.js'])await access(required);
const office=await readFile('dist/app/index.html','utf8');
if(office.length<100000)throw new Error(`Office UI is unexpectedly small (${office.length} bytes)`);
for(const marker of ['id="view-schedule"','id="view-clients"','id="view-invoices"','r18-ui-parity-bridge.js'])if(!office.includes(marker))throw new Error(`Active office UI missing ${marker}`);
console.log(`TUINBOOKS R18 STATIC: PASS · full office UI active · ${files.length} isolated rewrite modules · ${imports} relative imports · 0 missing`);
