const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
const office=fs.readFileSync(path.join(root,'index.html'),'utf8');
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(html.includes('pattern="[0-9]{4}"'),'mobile input must require four numeric digits');
ok(html.includes('maxlength="4"'),'mobile input maxlength must be four');
ok(html.includes('inputmode="numeric"'),'mobile input should use numeric keypad');
ok(!html.includes('10-character code'),'mobile copy must not request ten characters');
ok(js.includes("replace(/[^0-9]/g,'').slice(0,4)"),'pairing code must be normalised to four digits');
ok(js.includes('code.length!==4'),'pairing validation must require four digits');
ok(!js.includes("code.length!==10"),'obsolete ten-character validation must be removed');
ok(office.includes('four-digit setup PIN'),'office copy must match database code format');
console.log('v55.5.0 mobile pairing tests passed');
