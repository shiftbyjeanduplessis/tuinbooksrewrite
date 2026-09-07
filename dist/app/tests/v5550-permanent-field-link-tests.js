const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
const office=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
function ok(value,message){if(!value)throw new Error(message);}
ok(js.includes("slice(0,4)"),'mobile PIN must be normalised to four digits');
ok(js.includes('code.length!==4'),'mobile PIN validation must require four digits');
ok(mobile.includes('pattern="[0-9]{4}"'),'mobile PIN input must accept exactly four digits');
ok(mobile.includes('stays linked until the office changes or disables access'),'mobile copy must explain durable office-managed pairing');
ok(!mobile.includes('id="mobileSignOutBtn"'),'field phone must not expose self-unpair control');
ok(office.includes('four-digit setup PIN'),'office copy must describe the four-digit setup PIN');
ok(office.includes('stays linked until the office changes or disables access'),'office copy must describe durable pairing');
ok(sw.includes('tuinbooks-shell-v56-0-5-schedule-card-format1'),'service worker cache must be current');
console.log('v55.5.0 permanent field link tests passed');
