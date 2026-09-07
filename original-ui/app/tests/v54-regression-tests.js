'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const {webcrypto}=require('crypto');

const migration42=fs.readFileSync(path.join(__dirname,'..','supabase','migration-v42-operational-sync.sql'),'utf8');
assert(
  /alter table public\.invoices[\s\S]*add column if not exists invoice_number text/.test(migration42),
  'The v42 migration must repair pre-v42 invoice tables that lack invoice_number'
);
assert(
  /nullif\(payload->>'number',''\)/.test(migration42),
  'The invoice compatibility repair must preserve an existing payload invoice number'
);
assert(
  /add column if not exists visit_date date/.test(migration42)&&/column_name='work_date'/.test(migration42),
  'The v42 migration must map the early schedule work_date column to visit_date'
);
assert(
  /add column if not exists work_done text\[\]/.test(migration42)&&/payload->'workDone'/.test(migration42),
  'The v42 migration must restore structured work details from the early payload'
);
const migration54=fs.readFileSync(path.join(__dirname,'..','supabase','migration-v54-blocker-repairs.sql'),'utf8');
assert(
  /add column if not exists revoked_at timestamptz/.test(migration54),
  'The v54 migration must add revoked_at for early mobile access-code tables'
);

const appPath=path.join(__dirname,'..','app.js');
let source=fs.readFileSync(appPath,'utf8');
const closeIndex=source.lastIndexOf('\n})();');
assert(closeIndex>0,'Could not find TuinBooks application closure');
source=source.slice(0,closeIndex)+`
window.__v54Test={
  seedState,billingSourceLines,ensureDrafts,invoiceNeedsReview,
  coreSnapshotJsonV28,operationalSnapshotJsonV41,makeCoreSnapshotV28,
  hydrateWorkspaceStateV28,syncCoreSnapshotV28,syncOperationalSnapshotV41,
  setState(value){state=value;},getState(){return state;},backendV28
};`+source.slice(closeIndex);

const storage=new Map();
const document={body:{dataset:{app:'test'},classList:{add(){},remove(){}}},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},createElement(){return {id:'',className:'',innerHTML:'',classList:{add(){},remove(){}},querySelector(){return null;},querySelectorAll(){return []}};},addEventListener(){},documentElement:{scrollWidth:0}};
const window={document,crypto:webcrypto,indexedDB:null,addEventListener(){},matchMedia(){return {matches:false};},setInterval(){return 0;},clearInterval(){},confirm(){return true;}};
window.window=window;
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const context={window,document,localStorage,sessionStorage:localStorage,navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},screen:{width:1440,height:900},console,Intl,Date,Math,JSON,Map,Set,Promise,Array,Object,String,Number,Boolean,RegExp,Error,TypeError,Blob,URL,atob,btoa,setTimeout,clearTimeout,setInterval(){return 0;},clearInterval(){},confirm(){return true;},prompt(){return null;},crypto:webcrypto};
vm.createContext(context);vm.runInContext(source,context,{filename:'app.js'});
const t=window.__v54Test;

async function run(){
  const state=t.seedState();
  const client={id:'client-1',name:'Test client',address:'1 Test Road',suburb:'Test',whatsapp:'0710000000',status:'active',monthlyFee:1000};
  state.clients=[client];state.schedules=[];state.visits=[];state.quotes=[{id:'quote-1',clientId:client.id,status:'Approved',lineItems:[{id:'qline-1',description:'Once-off clean-up',qty:1,unitPrice:750}]}];state.invoices=[];
  t.setState(state);

  assert.equal(t.billingSourceLines(client,'2026-07').length,0,'An approved quote is not billable until linked work is completed');
  state.schedules=[{id:'job-quote',clientId:client.id,teamId:'team-1',date:'2026-07-20',quoteId:'quote-1',status:'completed'}];
  state.visits=[{id:'visit-quote',clientId:client.id,teamId:'team-1',date:'2026-07-20',scheduledJobId:'job-quote',workDone:['Clean-up']}];
  const completedQuoteLines=t.billingSourceLines(client,'2026-07');
  assert.equal(completedQuoteLines.length,1);
  assert.equal(completedQuoteLines[0].sourceKey,'quote:quote-1:qline-1');

  state.schedules=[];state.quotes=[];
  state.visits=[{id:'failed-visit',clientId:client.id,date:'2026-07-21',outcome:'Access failed',outcomeNote:'Gate locked'}];
  assert.equal(t.billingSourceLines(client,'2026-07').length,0,'Failed access must not become billable work');
  state.visits=[{id:'partial-visit',clientId:client.id,date:'2026-07-21',outcome:'Partially completed',workDone:['Front garden']}];
  const partialLines=t.billingSourceLines(client,'2026-07');
  assert.equal(partialLines.length,1);
  assert.equal(partialLines[0].sourceType,'partial-work-review');
  assert.equal(t.invoiceNeedsReview({clientId:client.id,lineItems:partialLines}),true,'Partial work must require an office billing decision');

  state.invoices=[{id:'sent-1',billingBatchId:'TB-202607-client-1',clientId:client.id,month:'2026-07',number:'INV-00001',status:'Sent',deliveryStatus:'Sent',lineItems:completedQuoteLines,createdAt:'2026-07-20T10:00:00Z'}];
  state.visits=[{id:'late-extra',clientId:client.id,teamId:'team-1',date:'2026-07-22',workDone:['Hedge'],extraDescription:'Additional hedge trimming',revenueType:'Existing-client add-on'}];
  t.ensureDrafts('2026-07');
  assert.equal(state.invoices.length,1,'Late work must not create a second active invoice for the same client and month');
  const existing=state.invoices[0];
  assert.equal(existing.needsOfficeReview,true,'Late work received after sending must flag the existing invoice for office review');
  assert(Array.isArray(existing.lateWorkPendingV5604)&&existing.lateWorkPendingV5604.length>0,'Late work sources must remain visible for review');

  const reviewInvoice={...existing,status:'Draft',deliveryStatus:'Not sent',lineItems:[...completedQuoteLines]};
  reviewInvoice.lineItems.push({...reviewInvoice.lineItems[0],id:'duplicate'});
  assert.equal(t.invoiceNeedsReview(reviewInvoice),true,'Duplicate billing sources must block sending');
  reviewInvoice.lineItems.pop();reviewInvoice.lineItems[0].sourceUnavailable=true;
  assert.equal(t.invoiceNeedsReview(reviewInvoice),true,'Unavailable billing sources must block sending');

  const coreJson=JSON.parse(t.coreSnapshotJsonV28({p_business_id:'b',p_expected_revision:9,p_business:{name:'A'}}));
  assert(!('p_business_id'in coreJson)&&!('p_expected_revision'in coreJson),'Core comparison must ignore transport identity and revision');
  const opJson=JSON.parse(t.operationalSnapshotJsonV41({p_business_id:'b',p_expected_revision:9,p_meta:{}}));
  assert(!('p_business_id'in opJson)&&!('p_expected_revision'in opJson),'Operational comparison must ignore transport identity and revision');

  t.backendV28.role='owner';t.backendV28.businessId='00000000-0000-0000-0000-000000000001';
  t.hydrateWorkspaceStateV28(
    {name:'Test',settings:{},onboarding_complete:true,core_revision:3},
    [{id:'team-active',name:'Active',active:true,payload:{}},{id:'team-old',name:'Old',active:false,payload:{}}],[],
    [{id:'client-1',name:'Test client',status:'active',payload:{}}],
    [{id:'site-a',customer_id:'client-1',address:'A',suburb:'One',active:true,payload:{}},{id:'site-b',customer_id:'client-1',address:'B',suburb:'Two',active:true,payload:{}}]
  );
  const coreSnapshot=t.makeCoreSnapshotV28();
  assert.equal(coreSnapshot.p_sites.length,2,'Secondary service sites must survive an office snapshot');
  assert.equal(coreSnapshot.p_teams.length,2,'Inactive historical teams must survive an office snapshot');
  assert.equal(coreSnapshot.p_teams.find(team=>team.id==='team-old').active,false);

  const autosave=t.getState();autosave.business.name='Before';
  t.backendV28.mode='supabase';t.backendV28.role='owner';t.backendV28.coreRevision=1;t.backendV28.coreConflict=false;t.backendV28.lastSnapshotJson='';t.backendV28.pendingSnapshot=null;
  const calls=[];const resolvers=[];
  t.backendV28.client={rpc(name,payload){calls.push({name,payload});return new Promise(resolve=>resolvers.push(resolve));}};
  const first=t.syncCoreSnapshotV28(true);
  await new Promise(resolve=>setTimeout(resolve,0));
  autosave.business.name='Edited during save';
  resolvers.shift()({data:{revision:2},error:null});await first;
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(calls.length,2,'An edit made during a core save must trigger a second save');
  assert.equal(calls[1].payload.p_business.name,'Edited during save');
  resolvers.shift()({data:{revision:3},error:null});await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(t.backendV28.coreDirty,false);

  autosave.schedules=[{id:'job-save',clientId:'client-1',teamId:'team-active',date:'2026-07-24',status:'scheduled',estimatedHours:1}];
  t.backendV28.operationalRevision=4;t.backendV28.operationalConflict=false;t.backendV28.operationalDirty=true;t.backendV28.operationalPendingSnapshot=null;t.backendV28.lastOperationalJson='';
  const opCalls=[],opResolvers=[];t.backendV28.client={rpc(name,payload){opCalls.push({name,payload});return new Promise(resolve=>opResolvers.push(resolve));}};
  const firstOperational=t.syncOperationalSnapshotV41(true);await new Promise(resolve=>setTimeout(resolve,0));
  autosave.schedules[0].status='deferred';
  opResolvers.shift()({data:{revision:5},error:null});await firstOperational;await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(opCalls.length,2,'An edit made during an operational save must trigger a second save');
  assert.equal(opCalls[1].payload.p_schedules[0].status,'deferred');
  opResolvers.shift()({data:{revision:6},error:null});await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(t.backendV28.operationalDirty,false);

  console.log('v54 regression tests passed');
}

run().catch(error=>{console.error(error);process.exitCode=1;});
