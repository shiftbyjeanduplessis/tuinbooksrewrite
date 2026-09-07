'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const {webcrypto}=require('crypto');

const appPath=path.join(__dirname,'..','app.js');
let source=fs.readFileSync(appPath,'utf8');
const closeIndex=source.lastIndexOf('\n})();');
assert(closeIndex>0,'Could not find TuinBooks application closure');
source=source.slice(0,closeIndex)+`
window.__v53Test={
  seedState,weekDates,startOfWeek,clientDueInWeekV10,monthlyDueDateV53,
  buildDraftForClient,reconcileDraftBillingSources,invoiceNeedsReview,
  makeOperationalSnapshotV41,deterministicPhotoPathV53,
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
  setInterval(){return 0;},clearInterval(){},confirm(){return true;}
};
window.window=window;
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const context={window,document,localStorage,sessionStorage:localStorage,navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},screen:{width:1440,height:900},console,Intl,Date,Math,JSON,Map,Set,Promise,Array,Object,String,Number,Boolean,RegExp,Error,TypeError,Blob,URL,atob,btoa,setTimeout,clearTimeout,setInterval(){return 0;},clearInterval(){},confirm(){return true;},crypto:webcrypto};
vm.createContext(context);vm.runInContext(source,context,{filename:'app.js'});
const t=window.__v53Test;

const state=t.seedState();
state.business={...state.business,vatRegistered:'no'};
state.clients=[];state.schedules=[];state.visits=[];state.quotes=[];state.invoices=[];
t.setState(state);

const fortnight={id:'client-fortnight',frequency:'Fortnightly',preferredDay:'Monday',recurrenceAnchorDate:'2026-07-06'};
assert.equal(t.clientDueInWeekV10(fortnight,'2026-07-06',t.weekDates('2026-07-06')),true);
assert.equal(t.clientDueInWeekV10(fortnight,'2026-07-13',t.weekDates('2026-07-13')),false);
assert.equal(t.clientDueInWeekV10(fortnight,'2026-07-20',t.weekDates('2026-07-20')),true);

const monthly={id:'client-monthly',frequency:'Monthly',preferredDay:'Monday',recurrenceAnchorDate:'2026-01-26'};
assert.equal(t.monthlyDueDateV53(monthly,'2026-02',monthly.recurrenceAnchorDate),'2026-02-23');
assert.equal(t.clientDueInWeekV10(monthly,'2026-02-23',t.weekDates('2026-02-23')),true);
assert.equal(t.clientDueInWeekV10(monthly,'2026-02-16',t.weekDates('2026-02-16')),false);

const client={id:'client-1',name:'Test client',status:'active',monthlyFee:1000};
state.clients=[client];state.visits=[{id:'visit-1',clientId:client.id,date:'2026-07-03',extraDescription:''}];
const draft=t.buildDraftForClient(client,'2026-07');
assert(draft,'A completed visit should create a billing draft');
assert.equal(draft.lineItems.length,1);
assert.equal(draft.lineItems[0].sourceKey,'contract:client-1:2026-07');

state.visits.push({id:'visit-2',clientId:client.id,date:'2026-07-10',extraDescription:'Extra hedge trimming'});
t.reconcileDraftBillingSources(draft,client,'2026-07');
t.reconcileDraftBillingSources(draft,client,'2026-07');
assert.equal(new Set(draft.lineItems.map(line=>line.sourceKey)).size,draft.lineItems.length,'Billing sources must not duplicate during repeated reconciliation');
assert(draft.lineItems.some(line=>line.sourceKey==='visit-extra:visit-2'),'New completed extras must be added to an existing draft');
assert.equal(t.invoiceNeedsReview(draft),true,'An unpriced extra must block a ready billing draft');

state.schedules=[{id:'job-1',date:'2026-07-20',clientId:client.id,teamId:'team-1',status:'scheduled',estimatedHours:2,sort:1,recurrenceKey:'client-1:2026-07-20'}];
state.visits=[{id:'visit-1',date:'2026-07-20',clientId:client.id,teamId:'team-1',scheduledJobId:'job-1',workDone:['Cut grass'],extraDescription:'',photoPaths:[]}];
state.opportunities=[];state.quotes=[];state.invoices=[draft];
t.backendV28.businessId='00000000-0000-0000-0000-000000000001';t.backendV28.operationalRevision=7;
const snapshot=t.makeOperationalSnapshotV41();
assert.equal(snapshot.p_expected_revision,7);
assert.equal(snapshot.p_schedules[0].visit_date,'2026-07-20');
assert.equal(snapshot.p_work_records[0].schedule_job_id,'job-1');
assert(!Object.prototype.hasOwnProperty.call(snapshot,'p_visits'));

const photoPath=t.deterministicPhotoPathV53({businessId:t.backendV28.businessId,type:'visit',createdAt:'2026-07-20T08:00:00Z',record:{date:'2026-07-20',teamId:'team-1'}},'visit-1',0);
assert(photoPath.endsWith('/visits/2026-07-20/visit-1-1.jpg'));

console.log('v53 unit tests passed');
