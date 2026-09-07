const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'schedule-foundation.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function assert(condition,message){if(!condition)throw new Error(message)}
assert(css.includes('v56.0.1 — top-menu cleanup and stable desktop fit'),'current navigation-fit marker missing');
assert(css.includes('display:grid!important'),'desktop navigation must use a stable content-aware grid');
assert(css.includes('minmax(160px,1.55fr)'),'long Opportunities & Quotes tab must receive additional width');
assert(html.includes('56.0.5-schedule-card-format1'),'HTML cache version not updated');
console.log('top navigation static tests passed');
