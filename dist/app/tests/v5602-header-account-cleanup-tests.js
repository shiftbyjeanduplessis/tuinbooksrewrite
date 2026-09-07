const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
function assert(value,message){if(!value)throw new Error(message);}
assert(html.includes('id="backendSyncState" class="backend-sync-state saved"'),'sync state must remain available for errors while the ready state starts hidden');
assert(!html.includes('id="backendUserLabel"'),'account display name must not be in the header');
assert(html.includes('id="backendSignOutBtn"'),'sign-out control must remain available');
assert(css.includes('v56.0.2 — clean account header'),'v56.0.2 header marker missing');
assert(css.includes('.desktop-body .backend-sync-state.saved{display:none!important}'),'routine ready status must be hidden');
assert(css.includes('min-width:126px!important'),'search control was not widened');
assert(html.includes('56.0.5-schedule-card-format1'),'desktop cache token is stale');
assert(sw.includes('tuinbooks-shell-v56-0-5-schedule-card-format1'),'service-worker cache token is stale');
console.log('v56.0.2 header account cleanup static tests passed');
