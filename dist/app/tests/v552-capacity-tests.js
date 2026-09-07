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
const css=fs.readFileSync(path.join(appRoot,'styles.css'),'utf8');
const migration=fs.readFileSync(path.join(appRoot,'supabase','migration-v552-capacity-commitments.sql'),'utf8');
const serviceWorker=fs.readFileSync(path.join(appRoot,'service-worker.js'),'utf8');

assert.equal(desktop,index,'Desktop cached entry point must match app index');
assert(index.includes('data-view="capacity"'),'Owner navigation must expose Capacity & Commitments');
assert(index.includes('id="view-capacity"'),'Capacity workspace must exist');
assert(index.includes('id="capacityRecoveryPanelV552"'),'Capacity Recovery Plan panel must exist');
assert(index.includes('id="capacityAgreementDialogV552"'),'Service agreement editor must exist');
assert(index.includes('id="capacityProfileDialogV552"'),'Owners must be able to edit realistic team capacity');
assert(index.includes('id="capacityExceptionDialogV552"'),'Owners must be able to record absences and temporary capacity');
assert(index.includes('id="capacityAgreementImpactV552"'),'Agreement activation must show capacity impact');
assert(index.includes('id="desktopOpportunityDialogV551"'),'Desktop Opportunity Spotter dialog must exist');
assert(mobile.includes('mobileOpportunityInlineBtnV551'),'Mobile visit workflow must expose Opportunity Spotter');
assert(mobile.includes('mobilePhotoCategoryV551'),'Mobile photos must support categories');
assert(mobile.includes('mobileOpportunityUrgencyV551'),'Mobile opportunity capture must include urgency');
assert(mobile.includes('mobileOpportunityNextV551'),'Mobile opportunity capture must include a recommended next step');
assert(css.includes('.schedule-control-room.detail-open .schedule-detail-panel'),'Route workspace override must be present');
assert(css.includes('top:76px!important'),'Route workspace must open near the top, not as a low bottom sheet');
assert(css.includes('.v55-badge.client-type-residential'),'Client-type chips must have controlled colours');
assert(css.includes('.v55-service-chip.service-lawn-mowing'),'Service chips must have controlled colours');
assert(serviceWorker.includes("tuinbooks-shell-v55-3-marketing-mileage1"),'Service worker cache must be versioned for v55.2');
assert(/create table if not exists public\.service_agreements/.test(migration),'Migration must create service agreements');
assert(/create table if not exists public\.service_commitments/.test(migration),'Migration must create service commitments');
assert(/create table if not exists public\.team_capacity_profiles/.test(migration),'Migration must create realistic capacity profiles');
assert(/create table if not exists public\.visit_photos/.test(migration),'Migration must keep structured visit-photo metadata');
assert(/schedule_jobs_sync_photos_v551/.test(migration),'Schedule photo metadata must stay synchronized');
assert(/operational_meta_sync_capacity_v552/.test(migration),'Operational snapshot must synchronize reporting mirrors');
assert(/enable row level security/.test(migration),'Capacity tables must use RLS');
assert(/is_business_member\(business_id\)/.test(migration),'Member reads must be tenant-scoped');
assert(/read-only relational mirrors/.test(migration),'Capacity mirrors must retain one authoritative operational write path');
assert(!/grant select,insert,update,delete/.test(migration),'Authenticated clients must not write directly to reporting mirrors');

const appPath=path.join(appRoot,'app.js');
let source=fs.readFileSync(appPath,'utf8');
const closeIndex=source.lastIndexOf('\n})();');
assert(closeIndex>0,'Could not find TuinBooks application closure');
source=source.slice(0,closeIndex)+`
window.__v552DeepTest={
  seedState,ensureV55State,ensureV552State,occurrenceWindowsV552,
  capacityStateV552,serviceCapabilityV552,generateCommitmentsV552,
  capacitySummaryV552,defaultProfileV552,agreementCapacityImpactV552,
  setState(value){state=value;},getState(){return state;},backendV28
};`+source.slice(closeIndex);

const storage=new Map();
const document={
  body:{dataset:{app:'test'},classList:{add(){},remove(){},toggle(){}}},
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
const t=window.__v552DeepTest;

assert.equal(t.capacityStateV552(300,360).key,'nearly-full','83% utilization must warn before full capacity');
assert.equal(t.capacityStateV552(350,360).key,'high-pressure','97% utilization must show high pressure');
assert.equal(t.capacityStateV552(390,360).key,'over-capacity','Work beyond realistic capacity must be flagged');
assert.equal(t.serviceCapabilityV552('irrigation-repair'),'irrigation');
assert.equal(t.serviceCapabilityV552('tree-work'),'tree-work');

const base=t.seedState();
base.business={...base.business,name:'Capacity Test Garden Service',settings:{}};
base.clients=[{
  id:'client-1',name:'Smith Home',status:'active',customerType:'Private',
  frequency:'Weekly',estimatedHours:1,serviceIds:['lawn-mowing'],
  preferredTeamId:'team-1',preferredDay:'Monday',clusterId:'cluster-1'
}];
base.teams=[{id:'team-1',name:'Protea Team',capacityHours:8,active:true,visualColor:'#2e8b68'}];
base.schedules=[];
base.visits=[];
base.catchUps=[];
base.serviceAgreements=[];
base.serviceCommitments=[];
base.teamCapacityProfiles=[];
base.capacityExceptions=[];
base.capacityOverrides=[];
base.fulfilmentPeriods=[];
t.setState(base);
t.ensureV55State();
assert.equal(t.ensureV552State(),true,'v55.2 state must create agreements and capacity profiles');
const upgraded=t.getState();
assert.equal(upgraded.serviceAgreements.length,1,'Each active client must receive an agreement suggestion');
assert.equal(upgraded.serviceAgreements[0].status,'Draft','Existing clients must require agreement review instead of silent activation');
assert.equal(upgraded.teamCapacityProfiles.length,6,'One capacity profile must exist for every configured Monday-to-Saturday workday');
assert(upgraded.teamCapacityProfiles[0].maxServiceMinutes<upgraded.teamCapacityProfiles[0].paidMinutes,'Realistic capacity must deduct operational time');

upgraded.serviceAgreements[0].status='Active';
t.generateCommitmentsV552('2026-08',{persist:false});
assert.equal(upgraded.serviceCommitments.filter(row=>row.periodKey==='2026-08').length,5,'A weekly agreement must generate the August weekday occurrences in its configured pattern');
assert(upgraded.serviceCommitments.every(row=>row.clientId==='client-1'),'Commitments must remain linked to the correct client');
assert(upgraded.serviceCommitments.every(row=>row.latestDate>=row.earliestDate),'Every commitment must have a valid fulfilment window');

const summary=t.capacitySummaryV552('2026-08');
assert(summary.promised>0,'Capacity summary must count promised service time');
assert(summary.available>summary.promised,'A normal single-client test month should retain capacity');

const weeklyWindows=t.occurrenceWindowsV552('2026-08',{frequency:'Weekly'},upgraded.serviceAgreements[0]);
assert(weeklyWindows.length>=4&&weeklyWindows.length<=6,'Weekly services must generate realistic weekly windows');
assert(weeklyWindows.every(row=>row.earliest<=row.preferred&&row.preferred<=row.latest),'Preferred date must stay inside the service window');

upgraded.teamCapacityProfiles.forEach(profile=>profile.maxServiceMinutes=10);
const overloaded={...upgraded.serviceAgreements[0],status:'Active',lines:upgraded.serviceAgreements[0].lines.map(line=>({...line,estimatedDurationMinutes:120}))};
const impact=t.agreementCapacityImpactV552(overloaded,'2026-08');
assert(impact.shortage>0,'Agreement activation must detect when a new client promise exceeds realistic capacity');

console.log('v55.2 capacity and commitment tests passed');
