'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const {webcrypto}=require('crypto');

const appRoot=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(appRoot,'index.html'),'utf8');
const desktop=fs.readFileSync(path.join(appRoot,'desktop.html'),'utf8');
const css=fs.readFileSync(path.join(appRoot,'styles.css'),'utf8');
const migration=fs.readFileSync(path.join(appRoot,'supabase','migration-v553-marketing-mileage.sql'),'utf8');
const serviceWorker=fs.readFileSync(path.join(appRoot,'service-worker.js'),'utf8');

assert.equal(desktop,index,'Desktop cached entry point must match app index');
assert(index.includes('data-view="marketing"'),'Owner navigation must expose Marketing');
assert(index.includes('data-view="mileage"'),'Owner navigation must expose Mileage & Fleet');
assert(index.includes('id="view-marketing"'),'Marketing workspace must exist');
assert(index.includes('id="view-mileage"'),'Mileage workspace must exist');
assert(index.includes('id="marketingAudienceModeV553"'),'Marketing audience builder must exist');
assert(index.includes('id="marketingCapacityImpactV553"'),'Marketing must check likely bookings against capacity');
assert(index.includes('id="marketingCampaignDialogV553"'),'Campaign draft workflow must exist');
assert(index.includes('id="marketingAcceptanceDialogV553"'),'Accepted replies must convert into work');
assert(index.includes('id="marketingAcceptanceLinkV553"'),'Accepted WhatsApp links must be convertible without losing response identity');
assert(index.includes('id="vehicleDialogV553"'),'Vehicle editor must exist');
assert(index.includes('id="routeLogDialogV553"'),'Odometer route log must exist');
assert(index.includes('id="v553IntelligenceReport"'),'Reports must include marketing and mileage intelligence');
assert(css.includes('.v553-audience-builder'),'Marketing layout styles must exist');
assert(css.includes('.v553-route-log'),'Mileage route-log styles must exist');
assert(serviceWorker.includes('tuinbooks-shell-v55-3-marketing-mileage1'),'Service worker cache must be versioned for v55.3');

for(const table of ['whatsapp_connections','marketing_templates','marketing_campaigns','marketing_campaign_recipients','whatsapp_messages','marketing_responses','marketing_work_links','vehicles','route_matrix_cache','team_route_logs']){
  assert(new RegExp(`create table if not exists public\\.${table}`).test(migration),`Migration must create ${table}`);
}
assert(/create trigger customers_sync_marketing_v553/.test(migration),'Customer marketing payload must synchronize into structured columns');
assert(/v_payload_changed boolean/.test(migration)&&/resurrect an old permission/.test(migration),'Webhook opt-outs must synchronize back into the authoritative client payload');
assert(/v55\.3 audience override/.test(migration)&&/Outside selected target/.test(migration),'Server-side sending must apply the same targeted audience as the app');
assert(/p_filters ->> 'serviceId'/.test(migration)&&/p_filters ->> 'clientType'/.test(migration)&&/p_filters ->> 'clusterId'/.test(migration)&&/p_filters ->> 'language'/.test(migration),'Server audience must enforce service, client type, cluster and language filters');
assert(/alter table public\.team_route_logs enable row level security/.test(migration),'Route logs must use RLS');
assert(/create policy team_route_logs_member_select_v553/.test(migration),'Route logs must be tenant-readable only');
assert(/create policy team_route_logs_admin_insert_v553/.test(migration),'Route writes must be permission controlled');
assert(/latitude numeric\(10,7\)/.test(migration)&&/longitude numeric\(10,7\)/.test(migration),'Service sites must support route coordinates');
assert(!/2026-07/.test(migration),'Migration must not hard-code a stale July 2026 fuel price');

for(const fn of ['send-whatsapp-campaign','whatsapp-webhook','update-fuel-prices']){
  assert(fs.existsSync(path.join(appRoot,'supabase','functions',fn,'index.ts')),`Edge Function ${fn} must be packaged`);
}

const appPath=path.join(appRoot,'app.js');
const source=fs.readFileSync(appPath,'utf8');
assert(source.includes('openMarketingAcceptanceForLinkV553'),'Pending accepted replies must expose an office conversion action');
assert(source.includes("from('marketing_work_links').select"),'Marketing backend must load webhook-created work links');
assert(source.includes("from('customers').select('id,whatsapp_number"),'Webhook opt-outs must be merged back into the live client state');
assert(source.includes('visitCount:Number(row.visit_count||0)'),'Mileage reload must preserve saved visit counts');
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
const t=window.__tuinbooksV553Test;
assert(t,'v55.3 test interface must be exposed');

assert.equal(t.normaliseZaMobile('082 397 6575'),'27823976575','South African local mobile must normalize to international digits');
assert.equal(t.normaliseZaMobile('+27 82 397 6575'),'27823976575','International South African mobile must normalize');
assert.equal(t.normaliseZaMobile('1234'),'','Invalid mobile must be rejected');

const base=t.seedState();
base.business={...base.business,name:'Marketing and Mileage Test',settings:{},marketingSettings:{cooldownDays:30,messageRate:.85,expectedResponseRate:10,defaultDurationMinutes:60},mileageSettings:{fuelPricePerLitre:25,fallbackKmPerVisit:10,defaultFuelType:'petrol_95',routeBaseLat:'',routeBaseLng:''}};
base.teams=[{id:'team-1',name:'Protea Team',capacityHours:8,active:true,capabilities:['general']}];
base.clusters=[{id:'cluster-1',name:'Central',active:true}];
base.clients=[
  {id:'c1',name:'Eligible Home',status:'active',phone:'082 111 1111',whatsappNumber:'082 111 1111',marketingAllowed:true,marketingOptOutAt:'',lastMarketingAt:'',preferredLanguage:'English',customerType:'Private',clientTypeId:'residential',clusterId:'cluster-1',serviceIds:['lawn-mowing'],latitude:-34,longitude:22},
  {id:'c2',name:'No Permission',status:'active',phone:'082 222 2222',whatsappNumber:'082 222 2222',marketingAllowed:false,marketingOptOutAt:'',lastMarketingAt:'',preferredLanguage:'English',customerType:'Private',clientTypeId:'residential',clusterId:'cluster-1',serviceIds:['lawn-mowing'],latitude:-34.01,longitude:22.01},
  {id:'c3',name:'Opted Out',status:'active',phone:'082 333 3333',whatsappNumber:'082 333 3333',marketingAllowed:true,marketingOptOutAt:'2026-07-01T00:00:00Z',lastMarketingAt:'',preferredLanguage:'Afrikaans',customerType:'Business',clientTypeId:'business',clusterId:'cluster-1',serviceIds:['irrigation-inspection']},
  {id:'c4',name:'Duplicate',status:'active',phone:'082 111 1111',whatsappNumber:'082 111 1111',marketingAllowed:true,marketingOptOutAt:'',lastMarketingAt:'',preferredLanguage:'English',customerType:'Private',clientTypeId:'residential',clusterId:'cluster-1',serviceIds:['lawn-mowing']},
  {id:'c5',name:'Invalid',status:'active',phone:'123',whatsappNumber:'123',marketingAllowed:true,marketingOptOutAt:'',lastMarketingAt:'',preferredLanguage:'English',customerType:'Private',clientTypeId:'residential',clusterId:'cluster-1',serviceIds:['lawn-mowing']},
  {id:'c6',name:'Inactive',status:'paused',phone:'082 666 6666',whatsappNumber:'082 666 6666',marketingAllowed:true,marketingOptOutAt:'',lastMarketingAt:'',preferredLanguage:'English',customerType:'Private',clientTypeId:'residential',clusterId:'cluster-1',serviceIds:['lawn-mowing']}
];
base.schedules=[{id:'s1',date:'2026-07-20',teamId:'team-1',clientId:'c1',estimatedHours:1,sort:1}];
base.visits=[];base.catchUps=[];base.serviceAgreements=[];base.serviceCommitments=[];base.teamCapacityProfiles=[];base.capacityExceptions=[];base.capacityOverrides=[];base.fulfilmentPeriods=[];
base.marketingCampaigns=[];base.marketingResponses=[];base.marketingWorkLinks=[];
base.vehicles=[{id:'v1',name:'Protea bakkie',teamId:'team-1',workingLPer100km:10,currentOdometer:1000,active:true}];
base.routeLogs=[];
t.setState(base);
t.ensureV55State();
t.ensureV552State();
t.ensureV553State();

const allAudience=t.audience({mode:'all',serviceId:'all',clientType:'all',clusterId:'all',language:'all',cooldownDays:30});
assert.deepEqual(Array.from(allAudience.eligible,row=>row.client.id),['c1'],'Only active, consented, valid, unique and non-opted-out clients may be paid recipients');
assert.equal(allAudience.exclusions['No recorded marketing permission'],1);
assert.equal(allAudience.exclusions['Marketing opted out'],1);
assert.equal(allAudience.exclusions['Duplicate number'],1);
assert.equal(allAudience.exclusions['No valid WhatsApp number'],1);

const targeted=t.audience({mode:'targeted',serviceId:'irrigation-inspection',clientType:'all',clusterId:'all',language:'all',cooldownDays:0});
assert.equal(targeted.targeted,1,'Targeting must narrow the audience before duplicate suppression');
assert.equal(targeted.eligible.length,0,'An opted-out targeted client must remain excluded');

const impact=t.capacityImpact({recipientCount:5,responseRate:100,duration:120,serviceId:'tree-work',start:'2026-08-03',end:'2026-08-03',audience:{eligible:[]}});
assert.equal(impact.required,600,'Campaign capacity must convert likely bookings into service minutes');
assert(impact.shortage>0,'Campaigns must warn when likely work exceeds suitable capacity');

assert.equal(t.actualDistance({startOdometer:100,endOdometer:145,actualDistanceKm:99}),45,'Odometer readings must be authoritative');
assert.equal(t.actualDistance({startOdometer:'',endOdometer:'',actualDistanceKm:42}),42,'Stored actual distance must be retained when odometers are absent');
const fuel=t.fuelCalculation({vehicleId:'v1',teamId:'team-1',date:'2026-07-20',startOdometer:100,endOdometer:200,fuelPricePerLitre:25,visitCount:4});
assert.equal(fuel.distance,100);
assert.equal(fuel.litres,10);
assert.equal(fuel.cost,250);
assert.equal(fuel.costPerVisit,62.5);
assert(Math.abs(t.haversine({lat:0,lng:0},{lat:1,lng:0})-111.19)<0.5,'Haversine distance must be geographically plausible');

const routeState=t.getState();
routeState.business.mileageSettings.routeBaseLat=-34;
routeState.business.mileageSettings.routeBaseLng=22;
routeState.schedules=[
  {id:'r1',date:'2026-08-03',teamId:'team-1',clientId:'c1',sort:1},
  {id:'r2',date:'2026-08-03',teamId:'team-1',clientId:'c2',sort:2}
];
const estimate=t.estimateRoute('team-1','2026-08-03');
assert(estimate.km>0&&estimate.source.includes('saved map pins'),'Pinned clients must produce a route planning estimate');

routeState.routeLogs=[
  {id:'log1',date:'2026-08-03',teamId:'team-1',vehicleId:'v1',plannedDistanceKm:90,startOdometer:100,endOdometer:200,fuelPricePerLitre:25,visitCount:4}
];
const totals=t.mileageTotals('2026-08');
assert.equal(totals.planned,90);
assert.equal(totals.actual,100);
assert.equal(totals.fuel,10);
assert.equal(totals.cost,250);
assert.equal(totals.visits,4);
assert.equal(totals.costPerVisit,62.5);

console.log('v55.3 marketing and mileage tests passed');
