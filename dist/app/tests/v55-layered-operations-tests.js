'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const {webcrypto}=require('crypto');

const appRoot=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(appRoot,'index.html'),'utf8');
const desktop=fs.readFileSync(path.join(appRoot,'desktop.html'),'utf8');
const mobile=fs.readFileSync(path.join(appRoot,'mobile.html'),'utf8');
const migration=fs.readFileSync(path.join(appRoot,'supabase','migration-v55-layered-operations.sql'),'utf8');

assert.equal(desktop,index,'The cached desktop entry point must match the live app index');
assert(index.includes('id="view-catchup"'),'The desktop app must include a dedicated Catch-up Queue view');
assert(fs.readFileSync(path.join(appRoot,'app.js'),'utf8').includes('Open catch-up queue'),'The scheduler CTA must use the exact Catch-up Queue wording');
assert(index.includes('Service catalogue'),'The office app must include the Service Catalogue');
assert(mobile.includes('mobileServiceGuideBtnV55'),'The mobile app must include the shared Service Guide control');
assert(/add column if not exists client_type text/.test(migration),'The v55 migration must add queryable client type data');
assert(/add column if not exists service_ids text\[\]/.test(migration),'The v55 migration must add queryable service assignments');
assert(/customers_sync_v55_classification/.test(migration),'The v55 migration must keep structured columns synced from JSON payloads');

const appPath=path.join(appRoot,'app.js');
let source=fs.readFileSync(appPath,'utf8');
const closeIndex=source.lastIndexOf('\n})();');
assert(closeIndex>0,'Could not find TuinBooks application closure');
source=source.slice(0,closeIndex)+`
window.__v55Test={
  seedState,ensureV55State,normaliseClientTypeV55,serviceIdsFromWorkV55,
  serviceIdsForClientV55,clientTypeDefV55,frequencyLabelV55,
  catchupRowsV55,invoiceStageCountsV55,
  setState(value){state=value;},getState(){return state;},backendV28
};`+source.slice(closeIndex);

const storage=new Map();
const document={
  body:{dataset:{app:'test'},classList:{add(){},remove(){}}},
  getElementById(){return null;},querySelectorAll(){return [];},
  addEventListener(){},documentElement:{scrollWidth:0}
};
const window={
  document,crypto:webcrypto,indexedDB:null,
  addEventListener(){},matchMedia(){return {matches:false};},
  setInterval(){return 0;},clearInterval(){},confirm(){return true;},
  location:{href:'https://example.test/app/',search:'',hash:''}
};
window.window=window;
const localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
const context={
  window,document,localStorage,sessionStorage:localStorage,
  navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},
  screen:{width:1440,height:900},console,Intl,Date,Math,JSON,Map,Set,
  Promise,Array,Object,String,Number,Boolean,RegExp,Error,TypeError,Blob,URL,
  atob,btoa,setTimeout,clearTimeout,setInterval(){return 0;},clearInterval(){},
  confirm(){return true;},prompt(){return null;},crypto:webcrypto
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'app.js'});
const t=window.__v55Test;

const state=t.seedState();
state.business={...state.business,name:'Test Garden Service'};
state.clients=[
  {id:'client-1',name:'Smith Home',customerType:'Private',frequency:'Weekly',workTypeIds:['lawn','hedges'],status:'active'},
  {id:'client-2',name:'Office Park',customerType:'Business',frequency:'Monthly',serviceDescription:'Irrigation inspection',status:'active'}
];
state.schedules=[
  {id:'job-1',clientId:'client-1',teamId:'team-1',date:'2026-07-20',status:'scheduled'},
  {id:'job-2',clientId:'client-2',teamId:'team-1',date:'2026-07-01',status:'scheduled'}
];
state.visits=[];
state.catchUps=[];
state.invoices=[];
t.setState(state);

assert.equal(t.ensureV55State(),true,'Existing records should receive v55 classifications on first load');
const upgraded=t.getState();
assert(upgraded.business.serviceCatalog.length>=10,'The shared service catalogue must be initialized');
assert.equal(upgraded.clients[0].clientTypeId,'Residential','Private clients must map to Residential');
assert.equal(upgraded.clients[1].clientTypeId,'Business','Business clients must retain Business classification');
assert(upgraded.clients[0].serviceIds.includes('lawn-mowing'),'Lawn work must map to the Lawn mowing service');
assert(upgraded.clients[0].serviceIds.includes('hedge-trimming'),'Hedge work must map to the Hedge trimming service');
assert(upgraded.clients[1].serviceIds.includes('irrigation-inspection'),'Irrigation descriptions must map to the irrigation service');
assert.deepEqual([...upgraded.schedules[0].serviceIds],[...upgraded.clients[0].serviceIds],'Open visits must inherit the client service package');
assert.equal(t.frequencyLabelV55('Fortnightly'),'2W');
assert.equal(t.clientTypeDefV55(upgraded.clients[0]).label,'Residential');

const catchUp=t.catchupRowsV55();
assert(catchUp.some(row=>row.job.id==='job-2'),'A past scheduled visit without an outcome must enter the Catch-up Queue');
const billing=t.invoiceStageCountsV55('2026-07');
assert(billing.resolution>=1,'Unresolved operational work must appear in Needs resolution, not invoice-ready work');

console.log('v55 layered operations tests passed');
