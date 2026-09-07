'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'schedule-foundation.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
function has(text,needle,message){assert(text.includes(needle),message);}
function lacks(text,needle,message){assert(!text.includes(needle),message);}
has(html,'56.0.5-schedule-card-format1','desktop assets must use v56.0.5');
has(sw,'tuinbooks-shell-v56-0-5-schedule-card-format1','service worker must use v56.0.5 cache');
has(app,"const TUINBOOKS_VERSION_V5600='56.0.5-schedule-card-format1'",'runtime version must be v56.0.5');
has(app,'<span class="schedule-card-copy">','schedule cards must group title and metadata');
has(app,'Math.max(52,Math.min(132','schedule cards must use compact proportional heights');
has(css,'.schedule-card-copy{display:grid','schedule card copy layout must exist');
has(css,'text-overflow:ellipsis','long client names must truncate cleanly');
has(css,'word-break:normal;overflow-wrap:normal','client names must not split character by character');
has(css,'grid-template-columns:18px minmax(0,1fr)','marker and copy must have stable columns');
lacks(css,'.schedule-card-clean{position:relative;padding-left:32px}','old absolute-marker padding must be removed');
console.log('v56.0.5 schedule card formatting static tests passed');
