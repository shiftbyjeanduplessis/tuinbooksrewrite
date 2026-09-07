/* TuinBooks v60.5.0 — isolated Business Workbook Import / Export on exact stable (48) */
(()=>{
'use strict';
const BUILD='60.7.4-business-workbook-verified-replacement-import';
const TEMPLATE='TuinBooks_Business_Workbook.xlsx';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const key=v=>clean(v).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
const hostWindow=()=>{try{return window.opener&&!window.opener.closed?window.opener:null}catch(_){return null}};
const runtime=()=>hostWindow()?.__tuinbooksOnboardingRuntimeV60423||null;
const state=()=>runtime()?.getState?.();
const uid=(p='id')=>runtime()?.uid?.(p)||`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
function getParser(){const p=hostWindow()?.__tuinbooksOnboardingMasterImportV60420;if(!p?.parseXlsxV60420)throw new Error('Open Import / Export from TuinBooks Settings, then try again.');return p.parseXlsxV60420;}
function toastMsg(m,t=''){const el=document.getElementById('bwMessage');if(el){el.textContent=String(m||'');el.className=`message ${t==='error'?'error':t==='success'?'success':''}`;}if(t!=='error'){try{hostWindow()?.toast?.(m,t)}catch(_){}}}
function rowsFor(parsed,name){return parsed?.sheets?.[name]||[];}
function headerObjects(rows){const list=rows||[];const idx=(Array.isArray(list[3])&&list[3].some(v=>clean(v)))?3:list.findIndex(r=>Array.isArray(r)&&r.some(v=>clean(v)));if(idx<0)return[];const headers=(rows[idx]||[]).map(clean);return rows.slice(idx+1).map((r,i)=>{const o={_row:Number(r?._row)||idx+i+2};headers.forEach((h,c)=>{if(h)o[h]=r?.[c]??'';});return o;});}
function get(row,...names){for(const n of names){if(Object.prototype.hasOwnProperty.call(row,n))return row[n];const k=key(n),hit=Object.keys(row).find(x=>key(x)===k);if(hit)return row[hit];}return'';}
function startMap(rows){const out={};(rows||[]).forEach(r=>{const k=key(r?.[0]);if(k)out[k]=r?.[1]??'';});return out;}
function sv(start,label){return start[key(label)]??'';}
function money(v){if(typeof v==='number')return v;const n=Number(clean(v).replace(/[R,\s]/gi,''));return Number.isFinite(n)?n:NaN;}
function mondayISO(v){const s=clean(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'';const d=new Date(`${s}T12:00:00`);return d.getDay()===1?s:'';}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function mondayThisWeek(){const now=new Date(),delta=(now.getDay()+6)%7,mon=new Date(now);mon.setDate(now.getDate()-delta);return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;}
function normStatus(v){const k=key(v);return k==='archived'?'archived':(k==='suspended'||k==='paused')?'paused':'active';}
function basis(v){return key(v).includes('monthly')?'Monthly Fixed':'Per Visit';}
function frequency(v){const raw=clean(v),k=key(v);if(k.includes('fortnight'))return 'Fortnightly';if(k==='monthly'||k.includes('once a month'))return 'Monthly';if(k.includes('custom'))return 'Custom';if(k.includes('weekly'))return 'Weekly';return raw||'Weekly';}
function expectedVisits(v){const f=frequency(v);return f==='Weekly'?4:f==='Fortnightly'?2:f==='Monthly'?1:null;}
function serviceCatalog(s){return Array.isArray(s?.business?.serviceCatalog)?s.business.serviceCatalog:[];}
function profiles(){return runtime()?.billingProfiles?.()||state()?.billingProfilesV59396||[];}
function mapProfile(row={}){return {id:row.id,businessId:row.business_id||row.businessId||'',displayName:row.display_name??row.displayName??'',legalName:row.legal_name??row.legalName??'',tradingName:row.trading_name??row.tradingName??'',registrationNumber:row.registration_number??row.registrationNumber??'',vatRegistered:Boolean(row.vat_registered??row.vatRegistered),vatNumber:row.vat_number??row.vatNumber??'',billingAddress:row.billing_address??row.billingAddress??'',email:row.email||'',phone:row.phone||'',website:row.website||'',bankName:row.bank_name??row.bankName??'',bankAccountHolder:row.bank_account_holder??row.bankAccountHolder??'',bankAccountNumber:row.bank_account_number??row.bankAccountNumber??'',bankBranchCode:row.bank_branch_code??row.bankBranchCode??'',bankAccountType:row.bank_account_type??row.bankAccountType??'',paymentReferenceNote:row.payment_reference_note??row.paymentReferenceNote??'',legacyBankingText:row.legacy_banking_text??row.legacyBankingText??'',quotePrefix:row.quote_prefix??row.quotePrefix??'QUO',invoicePrefix:row.invoice_prefix??row.invoicePrefix??'INV',creditNotePrefix:row.credit_note_prefix??row.creditNotePrefix??'CN',proformaPrefix:row.proforma_prefix??row.proformaPrefix??'PRO',statementPrefix:row.statement_prefix??row.statementPrefix??'STM',quoteNextNumber:Number(row.quote_next_number??row.quoteNextNumber??1),invoiceNextNumber:Number(row.invoice_next_number??row.invoiceNextNumber??1),creditNoteNextNumber:Number(row.credit_note_next_number??row.creditNoteNextNumber??1),proformaNextNumber:Number(row.proforma_next_number??row.proformaNextNumber??1),statementNextNumber:Number(row.statement_next_number??row.statementNextNumber??1),defaultPaymentTerms:row.default_payment_terms??row.defaultPaymentTerms??'Payment due within 7 days by EFT.',defaultInvoiceDueDays:Number(row.default_invoice_due_days??row.defaultInvoiceDueDays??7),defaultQuoteValidityDays:Number(row.default_quote_validity_days??row.defaultQuoteValidityDays??7),documentFooter:row.document_footer??row.documentFooter??'',aliases:Array.isArray(row.aliases)?row.aliases:[],isDefault:Boolean(row.is_default??row.isDefault),isActive:(row.is_active??row.isActive)!==false,createdAt:row.created_at??row.createdAt??'',updatedAt:row.updated_at??row.updatedAt??''};}
async function upsertProfile(profileId,payload){const rt=runtime(),s=state(),backend=rt?.getBackend?.();if(!s)throw new Error('This business is still loading.');s.billingProfilesV59396=Array.isArray(s.billingProfilesV59396)?s.billingProfilesV59396:[];if(backend?.mode==='supabase'){const {data,error}=await backend.client.rpc('save_billing_profile_v59396',{p_business_id:backend.businessId,p_profile_id:profileId||null,p_profile:payload});if(error)throw error;const saved=mapProfile(data);const i=s.billingProfilesV59396.findIndex(p=>String(p.id)===String(saved.id));if(i>=0)s.billingProfilesV59396[i]=saved;else s.billingProfilesV59396.push(saved);return saved;}let current=profileId?s.billingProfilesV59396.find(p=>String(p.id)===String(profileId)):null;if(!current)current=s.billingProfilesV59396.find(p=>key(p.displayName)===key(payload.displayName));const saved=mapProfile({...payload,id:current?.id||uid('billing-profile'),business_id:backend?.businessId||'',is_default:current?.isDefault||s.billingProfilesV59396.length===0,is_active:current?.isActive!==false,created_at:current?.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()});if(current)Object.assign(current,saved);else s.billingProfilesV59396.push(saved);return saved;}
function model(parsed,week1){
 const blockers=[],attentionMap=new Map(),warnings=[],required=['Setup','Services','Teams','Clients','Client Services','Schedule','Check'];
 const attention=(id,category,title,detail,steps,meta={})=>{
   const keyId=String(id||`${category}:${title}`),existing=attentionMap.get(keyId);
   if(existing){if(detail&&!existing.details.includes(detail))existing.details.push(detail);return existing;}
   const item={id:keyId,category,title,details:detail?[detail]:[],steps:Array.isArray(steps)?steps:[steps].filter(Boolean),...meta};attentionMap.set(keyId,item);return item;
 };
 required.forEach(n=>{if(!parsed.sheets[n])blockers.push(`Missing sheet: ${n}`)});
 const setup=startMap(rowsFor(parsed,'Setup')),mode=clean(sv(setup,'Mode')).toUpperCase(),financial=mode!=='PLANNING ONLY';
 const businessName=clean(sv(setup,'Business Name'));if(!businessName)blockers.push('Setup: Business Name is required.');if(!['FULL SERVICE','PLANNING ONLY'].includes(mode))blockers.push('Setup: Mode must be FULL SERVICE or PLANNING ONLY.');
 if(!clean(sv(setup,'Phone'))&&!clean(sv(setup,'Email')))attention('setup-contact','business','Business contact details','Add a phone number or email address.',['Open Settings → Business details.','Enter a phone number or email address.','Save settings.'],{action:'settings-business'});
 if(!mondayISO(week1))blockers.push('Choose the real Monday that Week 1 represents.');
 const services=headerObjects(rowsFor(parsed,'Services')).filter(r=>clean(get(r,'Service'))),teams=headerObjects(rowsFor(parsed,'Teams')).filter(r=>clean(get(r,'Team Name'))),clients=headerObjects(rowsFor(parsed,'Clients')).filter(r=>clean(get(r,'Client Name'))),clientServices=headerObjects(rowsFor(parsed,'Client Services')).filter(r=>clean(get(r,'Client'))||clean(get(r,'Service'))),schedule=headerObjects(rowsFor(parsed,'Schedule')).filter(r=>clean(get(r,'Client'))||clean(get(r,'Week'))||clean(get(r,'Day'))),billProfiles=financial?headerObjects(rowsFor(parsed,'Billing Profiles')).filter(r=>clean(get(r,'Billing Profile'))):[],billing=financial?headerObjects(rowsFor(parsed,'Client Billing')).filter(r=>clean(get(r,'Client'))):[];
 if(!services.length)blockers.push('Services: add at least one service.');if(!teams.length)blockers.push('Teams: add at least one team.');if(!clients.length)blockers.push('Clients: add at least one client.');
 const byId=(rows,idHeader)=>new Map(rows.map(r=>[clean(get(r,idHeader)),r]).filter(([id])=>id)),byName=(rows,nameHeader)=>new Map(rows.map(r=>[key(get(r,nameHeader)),r]).filter(([name])=>name));
 const serviceId=byId(services,'TuinBooks ID'),serviceName=byName(services,'Service'),teamId=byId(teams,'TuinBooks ID'),teamName=byName(teams,'Team Name'),clientId=byId(clients,'TuinBooks ID'),clientName=byName(clients,'Client Name');
 const resolveClient=r=>clientId.get(clean(get(r,'TuinBooks Client ID')))||clientId.get(clean(get(r,'TuinBooks ID')))||clientName.get(key(get(r,'Client')))||clientName.get(key(get(r,'Client Name')))||null;
 const resolveService=r=>serviceId.get(clean(get(r,'TuinBooks Service ID')))||serviceName.get(key(get(r,'Service')))||null;
 const resolveTeam=r=>teamId.get(clean(get(r,'TuinBooks Team ID')))||teamName.get(key(get(r,'Team')))||teamName.get(key(get(r,'Team Name')))||null;
 const clientIdentity=r=>clean(get(r,'TuinBooks ID'))?`id:${clean(get(r,'TuinBooks ID'))}`:`name:${key(get(r,'Client Name'))}`;
 const seenS=new Set(),seenT=new Set(),seenC=new Set();
 services.forEach(r=>{const n=clean(get(r,'Service')),k=key(n);if(seenS.has(k))blockers.push(`Services row ${r._row}: duplicate service “${n}”.`);seenS.add(k);});
 teams.forEach(r=>{const n=clean(get(r,'Team Name')),k=key(n);if(seenT.has(k))blockers.push(`Teams row ${r._row}: duplicate team “${n}”.`);seenT.add(k);});
 clients.forEach(r=>{
   const n=clean(get(r,'Client Name')),id=clientIdentity(r),status=normStatus(get(r,'Status')),freq=frequency(get(r,'Visit Frequency'));
   if(seenC.has(id)||(!clean(get(r,'TuinBooks ID'))&&seenC.has(`name:${key(n)}`)))blockers.push(`Clients row ${r._row}: duplicate client “${n}”.`);seenC.add(id);
   const missing=[];if(!clean(get(r,'Address')))missing.push('property address');if(!clean(get(r,'Suburb')))missing.push('suburb');
   if(missing.length)attention(`client-details:${key(n)}`,'client-details',`${n} — client details`,`${missing.join(' and ')} ${missing.length===1?'is':'are'} missing.`,['Open Clients.','Open this client.','Complete Property address and Confirmed suburb.','Save the client.'],{clientName:n,action:'client'});
   if(status==='active'){
     const planning=[];if(!['Weekly','Fortnightly','Monthly','Custom'].includes(freq))planning.push('frequency');if(!clean(get(r,'Preferred Day')))planning.push('preferred day');if(!resolveTeam(r))planning.push('team');
     if(planning.length)attention(`client-planning:${key(n)}`,'client-planning',`${n} — planning setup`,`${planning.join(', ')} ${planning.length===1?'needs':'need'} attention.`,['Open Clients.','Open this client.','Set the recurring frequency, team and preferred day.','Save the client.'],{clientName:n,action:'client'});
   }
 });
 const csCount=new Map();clientServices.forEach(r=>{const c=resolveClient(r),svc=resolveService(r);if(!c)blockers.push(`Client Services row ${r._row}: client “${clean(get(r,'Client'))}” was not found.`);if(!svc)blockers.push(`Client Services row ${r._row}: service “${clean(get(r,'Service'))}” is not in Services.`);if(c){const id=clientIdentity(c);csCount.set(id,(csCount.get(id)||0)+1);}});
 const schedCount=new Map(),schedSeen=new Set();schedule.forEach(r=>{
   const c=resolveClient(r),t=resolveTeam(r),w=Number(get(r,'Week')),d=clean(get(r,'Day'));
   if(!c)blockers.push(`Schedule row ${r._row}: client “${clean(get(r,'Client'))}” was not found.`);else if(normStatus(get(c,'Status'))!=='active')attention(`schedule-inactive:${key(get(c,'Client Name'))}`,'schedule',`${clean(get(c,'Client Name'))} — schedule`,`A schedule row exists for a client that is not Active.`,['Open Clients and confirm the client status.','If the client is active, set Status to Active. Otherwise remove the future schedule row.'],{clientName:clean(get(c,'Client Name')),action:'schedule'});
   if(!t)blockers.push(`Schedule row ${r._row}: team “${clean(get(r,'Team'))}” was not found.`);if(![1,2,3,4].includes(w))blockers.push(`Schedule row ${r._row}: Week must be 1, 2, 3 or 4.`);if(!DAYS.includes(d))blockers.push(`Schedule row ${r._row}: Day must be Monday to Sunday.`);
   if(c){const id=clientIdentity(c),slot=`${id}|${w}|${d}`;if(schedSeen.has(slot))attention(`schedule-duplicate:${slot}`,'schedule',`${clean(get(c,'Client Name'))} — duplicate visit`,`The workbook has more than one ${d} Week ${w} visit.`,['Open Schedule in the workbook.','Keep the intended visit and remove the duplicate row.','Re-import when convenient.'],{clientName:clean(get(c,'Client Name')),action:'import'});schedSeen.add(slot);schedCount.set(id,(schedCount.get(id)||0)+1);}
 });
 clients.forEach(r=>{if(normStatus(get(r,'Status'))!=='active')return;const n=clean(get(r,'Client Name')),id=clientIdentity(r),expected=expectedVisits(get(r,'Visit Frequency')),got=schedCount.get(id)||0;if(!csCount.get(id))attention(`client-services:${key(n)}`,'client-services',`${n} — services`,`No routine Client Services are set up.`,['Open Clients.','Open this client.','Add the regular services/tasks performed at this site.','Save the client.'],{clientName:n,action:'client'});if(expected===null){if(!got)attention(`client-schedule:${key(n)}`,'schedule',`${n} — schedule`,`Custom frequency has no standard visits listed.`,['Open Schedule.','Place the standard visits that should exist for this client.'],{clientName:n,action:'schedule'});}else if(got!==expected)attention(`client-schedule:${key(n)}`,'schedule',`${n} — schedule`,`Expected ${expected} standard visit${expected===1?'':'s'}; the workbook contains ${got}.`,['Open Schedule.','Add or remove this client’s standard visits until the four-week pattern matches the agreed frequency.'],{clientName:n,action:'schedule'});});
 const profileId=byId(billProfiles,'TuinBooks ID'),profileName=byName(billProfiles,'Billing Profile'),resolveProfile=r=>profileId.get(clean(get(r,'TuinBooks Billing Profile ID')))||profileId.get(clean(get(r,'TuinBooks ID')))||profileName.get(key(get(r,'Billing Profile')))||null;
 if(financial){
   if(!parsed.sheets['Billing Profiles'])attention('billing-profiles-sheet','billing-profile','Billing Profiles','The Full Service workbook has no Billing Profiles sheet.',['Open Settings → Billing Profiles.','Create or complete the invoice identity used by the business.'],{action:'settings-billing-profile'});
   if(!parsed.sheets['Client Billing'])attention('client-billing-sheet','client-billing','Client billing','The Full Service workbook has no Client Billing sheet.',['Open Import / Export.','Export the current business workbook.','Complete Client Billing and re-import.'],{action:'import'});
   const seenP=new Set();billProfiles.forEach(r=>{const n=clean(get(r,'Billing Profile')),k=clean(get(r,'TuinBooks ID'))||key(n);if(seenP.has(k))blockers.push(`Billing Profiles row ${r._row}: duplicate profile “${n}”.`);seenP.add(k);if(!clean(get(r,'Invoice / Company Name')))attention(`billing-profile:${key(n)}`,'billing-profile',`${n||'Billing Profile'} — invoice details`,`Invoice / Company Name is missing.`,['Open Settings → Billing Profiles.','Open this Billing Profile.','Complete the invoice/company details.','Save.'],{profileName:n,action:'settings-billing-profile'});});
   const globalDay=Number(state()?.business?.invoiceCycleDayV58963||state()?.business?.invoiceCycleDay||0);if(!Number.isInteger(globalDay)||globalDay<1||globalDay>31)attention('business-invoice-day','billing-cycle','Business invoice day','The global monthly invoice/draft day is not set. The workbook does not import a per-client invoice date.',['Open Settings → Invoices & email.','Enter the Monthly draft day (1–31).','Save settings.'],{action:'settings-invoice'});
   const billed=new Set();billing.forEach(r=>{const c=resolveClient(r),p=resolveProfile(r),charge=money(get(r,'Routine Charge')),rawBasis=clean(get(r,'Charge Basis')),day=clean(get(r,'Invoice Day (optional)'));if(!c)blockers.push(`Client Billing row ${r._row}: client “${clean(get(r,'Client'))}” was not found.`);if(!p)attention(`billing-profile-missing:${key(get(r,'Client'))}`,'client-billing',`${clean(get(r,'Client'))} — billing profile`,`Billing profile “${clean(get(r,'Billing Profile'))}” was not found.`,['Open Import / Export.','Export the current workbook.','Choose an existing Billing Profile for this client in Client Billing.','Re-import.'],{clientName:clean(get(r,'Client')),action:'import'});const problems=[];if(!Number.isFinite(charge)||charge<0)problems.push('routine charge');if(!['per visit','monthly fixed'].includes(key(rawBasis)))problems.push('charge basis');if(problems.length&&c)attention(`client-billing:${key(get(c,'Client Name'))}`,'client-billing',`${clean(get(c,'Client Name'))} — routine billing`,`${problems.join(' and ')} ${problems.length===1?'needs':'need'} confirmation.`,['Open Import / Export.','Export the current business workbook.','On Client Billing, choose Per Visit or Monthly Fixed and enter the agreed Routine Charge.','Re-import the corrected workbook.'],{clientName:clean(get(c,'Client Name')),action:'import'});if(day)warnings.push(`Client Billing row ${r._row}: Invoice Day is ignored. TuinBooks uses the business-wide invoice cycle.`);if(c)billed.add(clientIdentity(c));});clients.forEach(r=>{if(normStatus(get(r,'Status'))==='active'&&!billed.has(clientIdentity(r)))attention(`client-billing:${key(get(r,'Client Name'))}`,'client-billing',`${clean(get(r,'Client Name'))} — routine billing`,`No Client Billing row is set up.`,['Open Import / Export.','Export the current business workbook.','Add this client to Client Billing with the correct profile, basis and amount.','Re-import.'],{clientName:clean(get(r,'Client Name')),action:'import'});});
 }
 warnings.push('Import can continue with Needs attention items. Structural errors still block import.');
 const attentionItems=[...attentionMap.values()].map(item=>({...item,detail:item.details.join(' ')}));
 return {parsed,setup,mode,financial,businessName,services,teams,clients,clientServices,schedule,billProfiles,billing,week1,issues:[...new Set(blockers)],blockingIssues:[...new Set(blockers)],attention:attentionItems,warnings:[...new Set(warnings)],resolveClient,resolveService,resolveTeam,resolveProfile,clientIdentity};
}

function sleepV6068(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitCloudIdleV6068(backend,timeoutMs=20000){
 const started=Date.now();
 while((backend?.syncing||backend?.operationalSyncing)&&Date.now()-started<timeoutMs)await sleepV6068(100);
 if(backend?.syncing||backend?.operationalSyncing)throw new Error('TuinBooks is still finishing an earlier cloud save. Hard-refresh the main app, wait for Saved, then import once.');
 return true;
}
function stopQueuedCloudTimersV6068(backend){
 try{clearTimeout(backend?.syncTimer);}catch(_){}try{clearTimeout(backend?.operationalSyncTimer);}catch(_){}
 if(backend){backend.syncTimer=null;backend.operationalSyncTimer=null;backend.syncQueued=false;backend.operationalQueued=false;}
}
function businessSettingsPatchV6074(s){
 const b=s?.business||{};
 // Import only workbook-owned settings. Do NOT send the entire business state,
 // logo data, UI state or unrelated settings back through one RPC.
 return {
   workbookModeV60426:b.workbookModeV60426||'',
   serviceCatalog:Array.isArray(b.serviceCatalog)?b.serviceCatalog:[],
   needsAttentionV6052:Array.isArray(b.needsAttentionV6052)?b.needsAttentionV6052:[],
   businessWorkbookV60426:b.businessWorkbookV60426||null,
   mainContactV60426:b.mainContactV60426||'',
   townSuburbV60426:b.townSuburbV60426||'',
   provinceV60426:b.provinceV60426||'',
   countryV60426:b.countryV60426||'South Africa',
   currencyV60426:b.currencyV60426||'ZAR'
 };
}
function importPayloadV6074(s,importedJobs,scopeClientIds,{replaceClients,importStart,importEnd,expectedTeams,expectedCustomers,expectedSchedules}={}){
 const backend=runtime()?.getBackend?.();if(!backend?.businessId)throw new Error('This business is not connected to Supabase.');
 const validClusterIds=new Set((s.clusters||[]).map(row=>String(row.id||'')));
 const teams=(s.teams||[]).filter(t=>t&&t.active!==false).map(team=>({
   id:String(team.id||''),name:clean(team.name)||'Team',leader_name:clean(team.leaderName),capacity_hours:Number(team.capacityHours||8),buffer_hours:Number(team.bufferHours||0),active:true,
   payload:{id:String(team.id||''),name:clean(team.name)||'Team',leaderName:clean(team.leaderName),capacityHours:Number(team.capacityHours||8),bufferHours:Number(team.bufferHours||0),dailySiteCapacity:Number(team.dailySiteCapacity||0),active:true,createdAt:team.createdAt||'',updatedAt:team.updatedAt||''}
 })).filter(row=>row.id);
 const customers=(s.clients||[]).map(client=>({
   id:String(client.id||''),name:clean(client.name)||'Client',customer_type:clean(client.customerType)||'Private homeowner',contact_name:clean(client.contact),email:clean(client.email),phone:clean(client.whatsapp||client.phone),billing_address:clean(client.billingAddress),status:['active','paused','archived'].includes(client.status)?client.status:'active',billing_profile_id:clean(client.billingProfileIdV59396),payload:{...client}
 })).filter(row=>row.id);
 const sites=(s.clients||[]).map(client=>({
   id:String(client.siteId||`site-${client.id}`),customer_id:String(client.id||''),site_name:clean(client.siteName||client.name),address:clean(client.address),suburb:clean(client.suburb),cluster_id:validClusterIds.has(String(client.clusterId||''))?String(client.clusterId):null,access_notes:clean(client.accessNotes),pet_notes:clean(client.petNotes||client.gardenNotes),instructions:clean(client.serviceDescription),active:client.status!=='archived',payload:{id:String(client.siteId||`site-${client.id}`),customerId:String(client.id||''),siteName:clean(client.siteName||client.name),address:clean(client.address),suburb:clean(client.suburb),clusterId:validClusterIds.has(String(client.clusterId||''))?String(client.clusterId):'',accessNotes:clean(client.accessNotes),petNotes:clean(client.petNotes||client.gardenNotes),instructions:clean(client.serviceDescription),active:client.status!=='archived'}
 })).filter(row=>row.id&&row.customer_id);
 const schedules=(importedJobs||[]).map(job=>({
   id:String(job.id||''),visit_date:clean(job.date),client_id:String(job.clientId||''),team_id:String(job.teamId||''),status:clean(job.status)||'scheduled',estimated_hours:Number.isFinite(Number(job.estimatedHours))?Number(job.estimatedHours):1,sort_order:Number(job.sort||99),
   payload:{id:String(job.id||''),date:clean(job.date),clientId:String(job.clientId||''),teamId:String(job.teamId||''),status:clean(job.status)||'scheduled',estimatedHours:Number.isFinite(Number(job.estimatedHours))?Number(job.estimatedHours):1,sort:Number(job.sort||99),workKind:'recurring',workMarker:'R',revenueType:'Recurring contract',serviceIds:Array.isArray(job.serviceIds)?job.serviceIds:[],officeNotes:clean(job.officeNotes),startTimeV60426:clean(job.startTimeV60426),autoGenerated:false,manualOverride:true,onboardingMasterV60426:true,createdAt:job.createdAt||'',updatedAt:job.updatedAt||''}
 })).filter(row=>row.id&&row.visit_date&&row.client_id&&row.team_id);
 const payload={
   p_business_id:backend.businessId,
   p_business:{name:clean(s.business?.name)||'TuinBooks business',phone:clean(s.business?.phone),email:clean(s.business?.email),address:clean(s.business?.address),onboarding_complete:(typeof s.onboardingComplete==='boolean'?s.onboardingComplete:null),settings_patch:businessSettingsPatchV6074(s)},
   p_teams:teams,p_customers:customers,p_sites:sites,p_schedules:schedules,
   p_scope_client_ids:[...new Set((scopeClientIds||[]).map(String).filter(Boolean))],
   p_import_start:importStart,p_import_end:importEnd,p_replace_clients:!!replaceClients,
   p_expected_team_count:Number(expectedTeams||0),p_expected_customer_count:Number(expectedCustomers||0),
   p_expected_site_count:Number(expectedCustomers||0),p_expected_schedule_count:Number(expectedSchedules||0),
   p_expected_core_revision:Number(backend.coreRevision||0),p_expected_operational_revision:Number(backend.operationalRevision||0)
 };
 const bytes=new TextEncoder().encode(JSON.stringify(payload)).byteLength;
 if(bytes>4500000)throw new Error(`This workbook import is ${Math.ceil(bytes/1024/1024)} MB before upload, which is too large for a safe single import. Reduce embedded notes/media before importing.`);
 payload.__clientPayloadBytesV6074=bytes;
 return payload;
}
async function persistImportV6074(rt,payload){
 const backend=rt?.getBackend?.();
 if(!backend||backend.mode!=='supabase'||!backend.client||!backend.businessId){rt?.save?.();return {local:true};}
 stopQueuedCloudTimersV6068(backend);
 const send={...payload};delete send.__clientPayloadBytesV6074;
 const started=performance.now();
 const {data,error}=await backend.client.rpc('tuinbooks_apply_business_workbook_v6074',send);
 if(error){
   const text=[error?.message,error?.details,error?.hint].map(v=>String(v||'')).filter(Boolean).join(' ');
   if(/PGRST202|schema cache|Could not find the function|tuinbooks_apply_business_workbook_v6074/i.test(text))throw Object.assign(new Error('The v60.7.4 Supabase import migration has not been installed. Run the included SQL migration once, then retry.'),{details:text,code:error?.code||''});
   if(/statement timeout|57014|timed out|canceling statement/i.test(text))throw Object.assign(new Error('Supabase stopped the import before commit. The transaction was rolled back and TuinBooks did not retry it.'),{details:text,code:error?.code||''});
   if(/WORKBOOK_BUSY|55P03|lock timeout/i.test(text))throw Object.assign(new Error('Another TuinBooks save is using this business. Nothing was imported. Hard-refresh, wait for Saved, then run the import once.'),{details:text,code:error?.code||''});
   throw error;
 }
 backend.coreRevision=Number(data?.core_revision??backend.coreRevision);
 backend.operationalRevision=Number(data?.operational_revision??backend.operationalRevision);
 backend.coreDirty=false;backend.operationalDirty=false;backend.coreConflict=false;backend.operationalConflict=false;
 backend.pendingSnapshot=null;backend.operationalPendingSnapshot=null;
 return {...(data||{ok:true}),client_ms:Math.round(performance.now()-started),request_bytes:payload.__clientPayloadBytesV6074||0};
}

async function ensureRollingWithoutCloudRaceV6053(rt){
 const backend=rt?.getBackend?.(),host=hostWindow(),ensure=host?.__tuinbooksCanonicalRollingV6010?.ensure||host?.ensureRollingScheduleV58929;
 if(typeof ensure!=='function')return;
 // Core + imported 4-week schedule have already been persisted. Any rolling extension after this point
 // therefore references teams that definitely exist in Supabase.
 try{await ensure({reason:'business-workbook-import-v6053',showFeedback:false});}catch(error){console.warn('[v60.5.4 workbook] rolling extension after import',error);}
}

function matchByHiddenOrName(rows,row,idHeader,nameHeader){const hidden=clean(get(row,idHeader)),name=key(get(row,nameHeader));return hidden?rows.find(x=>String(x.id)===hidden):rows.find(x=>key(x.name||x.displayName)===name);}
async function apply(model,options={}){
 const rt=runtime(),s=state();if(!s)throw new Error('This business is still loading.');
 rt?.ensureState?.();
 const replaceClients=options?.replaceClients===true,backup=JSON.parse(JSON.stringify(s));
 const backendBefore=rt?.getBackend?.();
 if(backendBefore?.mode==='supabase')await waitCloudIdleV6068(backendBefore,20000);
 rt?.beginBusinessWorkbookImportV6054?.();
 try{
   s.business=s.business||{};
   Object.assign(s.business,{name:model.businessName,phone:clean(sv(model.setup,'Phone')),email:clean(sv(model.setup,'Email')),address:clean(sv(model.setup,'Physical Address')),mainContactV60426:clean(sv(model.setup,'Main Contact')),townSuburbV60426:clean(sv(model.setup,'Town / Suburb')),provinceV60426:clean(sv(model.setup,'Province')),countryV60426:clean(sv(model.setup,'Country'))||'South Africa',currencyV60426:clean(sv(model.setup,'Currency'))||'ZAR',workbookModeV60426:model.mode});
   // Logo/media are deliberately not changed by a client/schedule workbook import.
   // They belong in Business settings and can make a recovery import unnecessarily large.

   const catalog=serviceCatalog(s),serviceByWorkbookId=new Map(),serviceByName=new Map();
   model.services.forEach(r=>{const name=clean(get(r,'Service')),hidden=clean(get(r,'TuinBooks ID'));let svc=hidden?catalog.find(x=>String(x.id)===hidden):catalog.find(x=>key(x.name)===key(name));if(!svc){svc={id:uid('service'),iconId:'other',defaultDurationMinutes:60,defaultChecklist:['Complete the work confirmed by the office'],defaultInvoiceDescription:name,displayOrder:catalog.length+10};catalog.push(svc);}svc.name=name;svc.shortLabel=name;svc.active=true;svc.updatedAt=new Date().toISOString();serviceByName.set(key(name),svc.id);if(hidden)serviceByWorkbookId.set(hidden,svc.id);});
   s.business.serviceCatalog=catalog;

   s.teams=Array.isArray(s.teams)?s.teams:[];const existingTeams=[...s.teams],teamByWorkbookId=new Map(),teamByName=new Map(),nextTeams=[];
   model.teams.forEach(r=>{const name=clean(get(r,'Team Name')),hidden=clean(get(r,'TuinBooks ID'));let t=hidden?existingTeams.find(x=>String(x.id)===hidden):existingTeams.find(x=>key(x.name)===key(name));if(!t)t={id:uid('team'),capacityHours:8,bufferHours:0,dailySiteCapacity:0,createdAt:new Date().toISOString()};t.name=name;t.active=true;t.updatedAt=new Date().toISOString();if(replaceClients)nextTeams.push(t);else if(!s.teams.some(x=>String(x.id)===String(t.id)))s.teams.push(t);teamByName.set(key(name),t.id);if(hidden)teamByWorkbookId.set(hidden,t.id);});
   if(replaceClients)s.teams=nextTeams;

   const existingClients=Array.isArray(s.clients)?[...s.clients]:[],oldClientIds=new Set(existingClients.map(c=>String(c.id))),usedExisting=new Set();
   const clientByWorkbookId=new Map(),clientByName=new Map(),nextClients=[];
   model.clients.forEach(r=>{
     const name=clean(get(r,'Client Name')),hidden=clean(get(r,'TuinBooks ID')),address=clean(get(r,'Address'));
     let c=hidden?existingClients.find(x=>String(x.id)===hidden):existingClients.find(x=>!usedExisting.has(String(x.id))&&key(x.name)===key(name)&&key(x.address)===key(address));
     if(!c&&replaceClients){const same=existingClients.filter(x=>!usedExisting.has(String(x.id))&&key(x.name)===key(name));if(same.length===1)c=same[0];}
     if(!c){c={id:uid('client'),siteId:uid('site'),createdAt:new Date().toISOString()};}
     const preservedId=c.id,preservedSiteId=c.siteId||uid('site'),preservedCreated=c.createdAt||new Date().toISOString();
     usedExisting.add(String(preservedId));
     if(replaceClients){
       // Replace means the workbook is authoritative for current client setup.
       // Start from a clean client payload so broken/stale planning and billing fields
       // from a previous failed import cannot leak back into Eden. IDs are preserved
       // so completed work and issued documents remain linked historically.
       c={id:preservedId,siteId:preservedSiteId,createdAt:preservedCreated,monthlyFee:0,rateAmount:0,estimatedHours:1,serviceIds:[],workTypeIds:[],billingSetupNeedsAttentionV6052:false,invoiceCycleModeV58963:'business_default',invoiceCycleMode:'business_default',customInvoiceDayV58963:'',billingProfileIdV59396:'',customerType:'Private homeowner'};
     }
     const teamId=teamByWorkbookId.get(clean(get(r,'TuinBooks Team ID')))||teamByName.get(key(get(r,'Team')))||c.teamId||'';
     Object.assign(c,{name,status:normStatus(get(r,'Status')),contact:clean(get(r,'Contact Name')),whatsapp:clean(get(r,'Phone')),phone:clean(get(r,'Phone')),email:clean(get(r,'Email')),address,suburb:clean(get(r,'Suburb')),frequency:frequency(get(r,'Visit Frequency')),preferredDay:clean(get(r,'Preferred Day'))||'Monday',fixedDay:true,teamId,preferredTeamId:teamId,gardenNotes:clean(get(r,'Notes')),siteId:preservedSiteId,estimatedHours:Number(c.estimatedHours||1),updatedAt:new Date().toISOString()});
     if(replaceClients)nextClients.push(c);else if(!s.clients.some(x=>String(x.id)===String(c.id)))s.clients.push(c);
     clientByName.set(key(name),c.id);if(hidden)clientByWorkbookId.set(hidden,c.id);
   });
   if(replaceClients){s.clients=nextClients;const backend=rt?.getBackend?.();if(backend&&Array.isArray(backend.preservedServiceSitesV54))backend.preservedServiceSitesV54=backend.preservedServiceSitesV54.filter(site=>!oldClientIds.has(String(site?.customer_id||site?.customerId||'')));}

   const resolveClientId=r=>clientByWorkbookId.get(clean(get(r,'TuinBooks Client ID')))||clientByWorkbookId.get(clean(get(r,'TuinBooks ID')))||clientByName.get(key(get(r,'Client')))||clientByName.get(key(get(r,'Client Name')))||'';
   const resolveServiceId=r=>serviceByWorkbookId.get(clean(get(r,'TuinBooks Service ID')))||serviceByName.get(key(get(r,'Service')))||'';
   const resolveTeamId=r=>teamByWorkbookId.get(clean(get(r,'TuinBooks Team ID')))||teamByName.get(key(get(r,'Team')))||teamByName.get(key(get(r,'Team Name')))||'';

   const csByClient=new Map();model.clientServices.forEach(r=>{const cid=resolveClientId(r),sid=resolveServiceId(r);if(cid&&sid){if(!csByClient.has(cid))csByClient.set(cid,[]);csByClient.get(cid).push(sid);}});
   s.clients.forEach(c=>{if(replaceClients||csByClient.has(c.id))c.serviceIds=[...new Set(csByClient.get(c.id)||[])];});

   const profileByWorkbookId=new Map(),profileByName=new Map(),existingProfiles=profiles();
   if(model.financial){for(let i=0;i<model.billProfiles.length;i++){
     const r=model.billProfiles[i],name=clean(get(r,'Billing Profile')),hidden=clean(get(r,'TuinBooks ID')),existing=hidden?existingProfiles.find(p=>String(p.id)===hidden):existingProfiles.find(p=>key(p.displayName)===key(name));
     const payload={displayName:name,legalName:clean(get(r,'Invoice / Company Name')),tradingName:clean(get(r,'Trading Name')),registrationNumber:clean(get(r,'Registration No.')),vatRegistered:key(get(r,'VAT Registered'))==='yes',vatNumber:clean(get(r,'VAT No.')),email:clean(get(r,'Invoice Email')),phone:clean(get(r,'Phone')),website:clean(get(r,'Website')),billingAddress:clean(get(r,'Invoice Address')),defaultPaymentTerms:clean(get(r,'Payment Terms')),bankName:clean(get(r,'Bank Name')),bankAccountHolder:clean(get(r,'Account Name')),bankAccountNumber:clean(get(r,'Account Number')),bankBranchCode:clean(get(r,'Branch Code')),bankAccountType:clean(get(r,'Account Type')),paymentReferenceNote:clean(get(r,'Payment Reference')),quotePrefix:clean(get(r,'Quote Prefix'))||existing?.quotePrefix||'QUO',invoicePrefix:clean(get(r,'Invoice Prefix'))||existing?.invoicePrefix||'INV',creditNotePrefix:'CN',proformaPrefix:'PRO',statementPrefix:'STM',quoteNextNumber:Number(existing?.quoteNextNumber||1),invoiceNextNumber:Number(existing?.invoiceNextNumber||1),creditNoteNextNumber:Number(existing?.creditNoteNextNumber||1),proformaNextNumber:Number(existing?.proformaNextNumber||1),statementNextNumber:Number(existing?.statementNextNumber||1),defaultInvoiceDueDays:Number(existing?.defaultInvoiceDueDays||7),defaultQuoteValidityDays:Number(existing?.defaultQuoteValidityDays||7),documentFooter:clean(get(r,'Invoice Footer')),aliases:Array.isArray(existing?.aliases)?existing.aliases:[],isDefault:i===0,isActive:true};
     let saved=existing;if(!saved)saved=await upsertProfile(hidden||null,payload);profileByName.set(key(name),saved.id);if(hidden)profileByWorkbookId.set(hidden,saved.id);
   }}

   const todayIso=new Date().toISOString().slice(0,10),historicalStatus=new Set(['completed','missed','cancelled','canceled']);
   if(replaceClients){
     s.schedules=Array.isArray(s.schedules)?s.schedules:[];
     s.schedules=s.schedules.filter(j=>{if(!oldClientIds.has(String(j.clientId)))return true;const d=clean(j.date),st=key(j.status),routine=j.workKind==='recurring'||j.workMarker==='R'||j.onboardingMasterV60426===true;if(!routine)return true;return d<todayIso||historicalStatus.has(st);});
     if(Array.isArray(s.scheduleBasket))s.scheduleBasket=s.scheduleBasket.filter(x=>!oldClientIds.has(String(x?.clientId||'')));
     if(Array.isArray(s.serviceAgreements))s.serviceAgreements=s.serviceAgreements.filter(x=>!oldClientIds.has(String(x?.clientId||'')));
     if(Array.isArray(s.serviceCommitments))s.serviceCommitments=s.serviceCommitments.filter(x=>!oldClientIds.has(String(x?.clientId||'')));
   }
   const archivedIds=new Set(s.clients.filter(c=>c.status==='archived').map(c=>c.id));
   if(archivedIds.size&&Array.isArray(s.schedules))s.schedules=s.schedules.filter(j=>!archivedIds.has(j.clientId)||clean(j.date)<todayIso||historicalStatus.has(key(j.status)));

   s.schedules=Array.isArray(s.schedules)?s.schedules:[];
   const importStart=model.week1,importEnd=addDays(model.week1,27),importedClientIds=new Set(model.clients.map(r=>resolveClientId(r)).filter(Boolean));
   const intendedIds=new Set(),intendedSlots=new Set();
   model.schedule.forEach(r=>{const cid=resolveClientId(r),week=Number(get(r,'Week')),day=clean(get(r,'Day')),date=cid&&[1,2,3,4].includes(week)&&DAYS.includes(day)?addDays(model.week1,(week-1)*7+DAYS.indexOf(day)):'';const sid=clean(get(r,'TuinBooks Schedule ID'))||clean(get(r,'TuinBooks ID'));if(sid)intendedIds.add(sid);if(cid&&date)intendedSlots.add(`${cid}|${date}`);});
   s.schedules=s.schedules.filter(j=>{if(!importedClientIds.has(j.clientId))return true;if(!(j.workKind==='recurring'||j.workMarker==='R'))return true;const d=clean(j.date);if(d<importStart||d>importEnd||d<todayIso)return true;if(historicalStatus.has(key(j.status)))return true;if(intendedIds.has(String(j.id)))return true;if(intendedSlots.has(`${j.clientId}|${d}`))return true;return false;});

   const clientFirst=new Map(),importedJobs=[],routeSort=new Map();
   model.schedule.forEach(r=>{const cid=resolveClientId(r),tid=resolveTeamId(r),week=Number(get(r,'Week')),day=clean(get(r,'Day')),client=s.clients.find(c=>c.id===cid);if(!cid||!tid||client?.status!=='active'||![1,2,3,4].includes(week)||!DAYS.includes(day))return;const date=addDays(model.week1,(week-1)*7+DAYS.indexOf(day)),jobHidden=clean(get(r,'TuinBooks Schedule ID'))||clean(get(r,'TuinBooks ID')),slotKey=`${week}|${day}|${tid}`,sort=(routeSort.get(slotKey)||0)+1;routeSort.set(slotKey,sort);let job=jobHidden?s.schedules.find(x=>String(x.id)===jobHidden):s.schedules.find(x=>x.clientId===cid&&x.date===date&&(x.workKind==='recurring'||x.workMarker==='R')&&!['cancelled','canceled'].includes(key(x.status)));if(!job){job={id:uid('sch'),createdAt:new Date().toISOString()};s.schedules.push(job);}Object.assign(job,{date,clientId:cid,teamId:tid,status:'scheduled',estimatedHours:Number(client?.estimatedHours||1),sort,workKind:'recurring',workMarker:'R',revenueType:'Recurring contract',serviceIds:[...(client?.serviceIds||[])],officeNotes:clean(get(r,'Notes')),startTimeV60426:clean(get(r,'Start Time')),autoGenerated:false,manualOverride:true,onboardingMasterV60426:true,updatedAt:new Date().toISOString()});importedJobs.push(job);if(!clientFirst.has(cid)||date<clientFirst.get(cid))clientFirst.set(cid,date);});
   s.clients.forEach(c=>{if(clientFirst.has(c.id)){c.recurrenceAnchorDate=clientFirst.get(c.id);c.serviceStartDate=clientFirst.get(c.id);c.awaitingInitialRecurringPlacementV6036=false;c.autoScheduleEnabled=c.status==='active'&&c.frequency!=='Custom';if(c.autoScheduleEnabled){c.scheduleSource='business-workbook';c.schedulingPolicyV58951='business-workbook';c.preferredTeamId=c.preferredTeamId||c.teamId||'';}}});

   const billedIds=new Set();
   if(model.financial){model.billing.forEach(r=>{const c=s.clients.find(x=>x.id===resolveClientId(r));if(!c)return;const pId=profileByWorkbookId.get(clean(get(r,'TuinBooks Billing Profile ID')))||profileByName.get(key(get(r,'Billing Profile')))||profiles().find(p=>key(p.displayName)===key(get(r,'Billing Profile')))?.id||'',charge=money(get(r,'Routine Charge')),rawBasis=clean(get(r,'Charge Basis')),validBasis=['per visit','monthly fixed'].includes(key(rawBasis)),validCharge=Number.isFinite(charge)&&charge>=0;if(pId)c.billingProfileIdV59396=pId;c.invoiceCycleModeV58963='business_default';c.invoiceCycleMode='business_default';c.customInvoiceDayV58963='';c.billingNotes=clean(get(r,'Notes'));billedIds.add(c.id);if(validBasis&&validCharge){const b=basis(rawBasis);c.rateAmount=charge;c.monthlyFee=b==='Monthly Fixed'?charge:0;c.priceBasis=b;c.billingArrangement=b==='Monthly Fixed'?'Monthly fixed fee':'Per visit';c.billingSetupNeedsAttentionV6052=false;rt?.applyBillingClassification?.(c);}else{if(replaceClients){c.rateAmount=0;c.monthlyFee=0;c.priceBasis='Not classified';c.billingArrangement='Not classified';}c.billingSetupNeedsAttentionV6052=true;}});s.clients.filter(c=>c.status==='active').forEach(c=>{if(!billedIds.has(c.id))c.billingSetupNeedsAttentionV6052=true;});}

   s.business.needsAttentionV6052=(model.attention||[]).map(item=>({...item,clientId:item.clientName?clientByName.get(key(item.clientName))||'':'',profileId:item.profileName?profileByName.get(key(item.profileName))||'':''}));
   s.business.businessWorkbookV60426={build:BUILD,mode:model.mode,lastImportedAt:new Date().toISOString(),week1:model.week1,fileName:model.parsed.fileName||'',importMode:replaceClients?'replace-clients':'merge'};
   rt?.ensureState?.();
   const scopeClientIds=model.clients.map(r=>resolveClientId(r)).filter(Boolean);
   if(scopeClientIds.length!==model.clients.length)throw new Error(`Import preflight stopped: ${model.clients.length-scopeClientIds.length} client/site row(s) could not be mapped safely.`);
   if(importedJobs.length!==model.schedule.length)throw new Error(`Import preflight stopped: workbook has ${model.schedule.length} standard visits but only ${importedJobs.length} could be built safely. Nothing was sent to Supabase.`);
   const payload=importPayloadV6074(s,importedJobs,scopeClientIds,{replaceClients,importStart,importEnd,expectedTeams:model.teams.length,expectedCustomers:model.clients.length,expectedSchedules:model.schedule.length});
   const server=await persistImportV6074(rt,payload);
   // Keep all normal cloud writers frozen until the page reloads. Unlocking them here
   // creates a race window where the locally-mutated state can be autosaved a second time.
   // The browser is deliberately reloaded from Supabase after a successful import.
   // This prevents a locally-mutated pre-commit state from being mistaken for the database result.
   setTimeout(()=>{try{hostWindow()?.location?.reload();}catch(_){}},180);
   return {clients:Number(server?.customers??model.clients.length),teams:Number(server?.teams??model.teams.length),visits:Number(server?.schedules??importedJobs.length),attention:(model.attention||[]).length,replaced:replaceClients?existingClients.length:0,verified:true,serverMs:Number(server?.duration_ms||0),requestBytes:Number(server?.request_bytes||0)};
 }catch(error){
   // v60.7.4 is a bounded PostgreSQL transaction. Any error means Supabase rolled
   // the entire workbook import back, so the browser must also return to its exact pre-import state.
   try{
     const backend=rt?.getBackend?.();stopQueuedCloudTimersV6068(backend);
     rt?.replaceState?.(backup);
     rt?.endBusinessWorkbookImportV6054?.();
     rt?.saveBusinessWorkbookLocalV6054?.();
   }catch(_){}
   throw error;
 }
}
// ---------- XLSX round-trip export: populate the approved workbook template ----------
const DECODER=new TextDecoder('utf-8'),SS_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL_NS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function u16(v,o){return v[o]|(v[o+1]<<8)}function u32(v,o){return (v[o]|(v[o+1]<<8)|(v[o+2]<<16)|(v[o+3]<<24))>>>0}
async function unzipWorkbook(buffer){const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);let e=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){if(u32(bytes,i)===0x06054b50){e=i;break}}if(e<0)throw new Error('The workbook file could not be opened.');const total=u16(bytes,e+10),central=u32(bytes,e+16),files=new Map();let p=central;for(let n=0;n<total;n++){if(u32(bytes,p)!==0x02014b50)throw new Error('The workbook ZIP directory is damaged.');const method=u16(bytes,p+10),size=u32(bytes,p+20),nl=u16(bytes,p+28),el=u16(bytes,p+30),cl=u16(bytes,p+32),local=u32(bytes,p+42),name=DECODER.decode(bytes.slice(p+46,p+46+nl)).replace(/^\//,'');if(u32(bytes,local)!==0x04034b50)throw new Error(`The workbook entry ${name} is damaged.`);const lnl=u16(bytes,local+26),lel=u16(bytes,local+28),start=local+30+lnl+lel,compressed=bytes.slice(start,start+size);let unpacked;if(method===0)unpacked=compressed;else if(method===8){const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));unpacked=new Uint8Array(await new Response(stream).arrayBuffer())}else throw new Error(`Unsupported workbook compression method (${method}).`);files.set(name,unpacked);p+=46+nl+el+cl}return files}
function bytesText(b){return DECODER.decode(b||new Uint8Array())}function encText(s){return new TextEncoder().encode(s)}
function xmlDecode(s=''){return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}function xattr(attrs,name){const m=String(attrs).match(new RegExp('(?:^|\\s)'+name.replace(':','\\:')+'="([^"]*)"'));return m?xmlDecode(m[1]):''}
function workbookPaths(files){const wb=bytesText(files.get('xl/workbook.xml')),rels=bytesText(files.get('xl/_rels/workbook.xml.rels')),rmap={};for(const m of rels.matchAll(/<(?:[A-Za-z0-9_]+:)?Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?Relationship>)/g))rmap[xattr(m[1],'Id')]=xattr(m[1],'Target');const out={};for(const m of wb.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b([^>]*?)\/?\s*>/g)){const name=xattr(m[1],'name'),rid=xattr(m[1],'r:id'),target=rmap[rid];if(name&&target){let p=target.replace(/^\//,'');if(!p.startsWith('xl/'))p=`xl/${p.replace(/^\.\//,'')}`;out[name]=p}}return out}
function parseSheet(files,path){return new DOMParser().parseFromString(bytesText(files.get(path)),'application/xml')}function sheetXmlText(doc){return new XMLSerializer().serializeToString(doc)}
function refCol(ref){let n=0;for(const c of String(ref).match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'')n=n*26+c.charCodeAt(0)-64;return n}function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function rowNode(doc,rowNum){const data=doc.getElementsByTagNameNS(SS_NS,'sheetData')[0];let before=null;for(const r of data.getElementsByTagNameNS(SS_NS,'row')){const n=Number(r.getAttribute('r'));if(n===rowNum)return r;if(n>rowNum&&!before)before=r}const r=doc.createElementNS(SS_NS,'row');r.setAttribute('r',String(rowNum));before?data.insertBefore(r,before):data.appendChild(r);return r}
function cellNode(doc,ref){const row=Number(String(ref).match(/\d+/)?.[0]||0),target=refCol(ref),r=rowNode(doc,row);for(const c of [...r.children]){if(c.localName!=='c')continue;const n=refCol(c.getAttribute('r'));if(n===target)return c;if(n>target){const cell=doc.createElementNS(SS_NS,'c');cell.setAttribute('r',ref);r.insertBefore(cell,c);return cell}}const cell=doc.createElementNS(SS_NS,'c');cell.setAttribute('r',ref);r.appendChild(cell);return cell}
function setCell(doc,ref,value){const c=cellNode(doc,ref);while(c.firstChild)c.removeChild(c.firstChild);c.removeAttribute('t');if(value===null||value===undefined||value==='')return c;if(typeof value==='number'&&Number.isFinite(value)){const v=doc.createElementNS(SS_NS,'v');v.textContent=String(value);c.appendChild(v);return c}c.setAttribute('t','inlineStr');const is=doc.createElementNS(SS_NS,'is'),t=doc.createElementNS(SS_NS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value);is.appendChild(t);c.appendChild(is);return c}
function clearCells(doc,rowStart,rowEnd,cols){for(let r=rowStart;r<=rowEnd;r++)for(const col of cols)setCell(doc,`${col}${r}`,'')}
function hiddenCols(doc,maxRow=1204){let cols=doc.getElementsByTagNameNS(SS_NS,'cols')[0];if(!cols){cols=doc.createElementNS(SS_NS,'cols');const data=doc.getElementsByTagNameNS(SS_NS,'sheetData')[0];data.parentNode.insertBefore(cols,data)}const col=doc.createElementNS(SS_NS,'col');col.setAttribute('min','26');col.setAttribute('max','28');col.setAttribute('hidden','1');col.setAttribute('width','2');col.setAttribute('customWidth','1');cols.appendChild(col);const dim=doc.getElementsByTagNameNS(SS_NS,'dimension')[0];if(dim)dim.setAttribute('ref',`A1:AB${maxRow}`)}
function splitLegacyServices(c){const out=[];for(const raw of [c.serviceDescription,c.customTasks])for(const part of String(raw||'').split(/\r?\n|;|\|/)){const name=clean(part);if(name&&name.length<=120&&!out.some(x=>key(x)===key(name)))out.push(name)}return out}
function nextMonday(){const d=new Date(),add=(8-d.getDay())%7||7;d.setDate(d.getDate()+add);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function exportData(){
 const s=state();if(!s)throw new Error('This business is still loading.');
 const mode=s.business?.workbookModeV60426||s.business?.businessWorkbookV60426?.mode||'FULL SERVICE';
 const catalog=serviceCatalog(s),serviceRows=catalog.filter(x=>x.active!==false).map(x=>({name:clean(x.name),id:x.id||''})).filter(x=>x.name);
 const serviceById=new Map(catalog.map(x=>[String(x.id),x]));
 const clients=s.clients||[],clientServices=[];
 for(const c of clients){
   let linked=0;
   for(const id of c.serviceIds||[]){const svc=serviceById.get(String(id));if(svc?.name){clientServices.push({client:c,service:{name:clean(svc.name),id:svc.id||''},notes:''});linked++;}}
   // Do NOT silently add legacy/client-only services to the master Services sheet.
   // If old data contains a service outside the master list, export it only under Client Services so Excel flags it.
   if(!linked){for(const name of splitLegacyServices(c)){clientServices.push({client:c,service:{name,id:''},notes:'Review: this service is not linked to the master Services list in TuinBooks.'});}}
 }
 const teams=(s.teams||[]).filter(x=>x.active!==false),start=mondayThisWeek(),end=addDays(start,27),scheduleRows=[];
 for(const c of clients.filter(c=>c.status==='active')){
   const jobs=(s.schedules||[]).filter(j=>j.clientId===c.id&&clean(j.date)>=start&&clean(j.date)<=end&&(j.workKind==='recurring'||j.workMarker==='R')&&!['cancelled','canceled'].includes(key(j.status))).sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.sort||0)-Number(b.sort||0));
   for(const j of jobs){
     const days=Math.round((new Date(`${j.date}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000),week=Math.floor(days/7)+1;
     if(week<1||week>4)continue;
     const day=DAYS[(days%7+7)%7]||c.preferredDay||'Monday',team=teams.find(t=>t.id===j.teamId)||teams.find(t=>t.id===c.teamId)||null;
     scheduleRows.push({week,day,client:c,team,startTime:j.startTimeV60426||'',notes:j.officeNotes||'',scheduleId:j.id||''});
   }
 }
 return {s,mode,serviceRows,teams,clients,clientServices,start,scheduleRows,profiles:profiles(),billing:clients.filter(c=>c.status==='active')};
}
function populateTemplate(files,data){const paths=workbookPaths(files),docs={};for(const [name,path] of Object.entries(paths))docs[name]=parseSheet(files,path);const S=docs.Setup;setCell(S,'A2','Exported from TuinBooks. Review the visible business information, fix anything needed and import the workbook again.');[['B4',data.mode],['B5',data.s.business?.name||''],['B6',data.s.business?.mainContactV60426||''],['B7',data.s.business?.phone||''],['B8',data.s.business?.email||''],['B9',data.s.business?.address||''],['B10',data.s.business?.townSuburbV60426||''],['B11',data.s.business?.provinceV60426||''],['B12',data.s.business?.countryV60426||'South Africa'],['B13',data.s.business?.currencyV60426||'ZAR'],['B14','STANDARD 4-WEEK MONTH']].forEach(([r,v])=>setCell(S,r,v));
 const svc=docs.Services;clearCells(svc,5,104,['A','B','Z']);setCell(svc,'Z4','TuinBooks ID');data.serviceRows.slice(0,100).forEach((x,i)=>{const r=i+5;setCell(svc,`A${r}`,x.name);setCell(svc,`Z${r}`,x.id)});hiddenCols(svc,104);
 const team=docs.Teams;clearCells(team,5,104,['A','B','Z']);setCell(team,'Z4','TuinBooks ID');data.teams.slice(0,100).forEach((x,i)=>{const r=i+5;setCell(team,`A${r}`,x.name);setCell(team,`Z${r}`,x.id)});hiddenCols(team,104);
 const cl=docs.Clients;clearCells(cl,5,404,['A','B','C','D','E','F','G','H','I','J','K','Z','AA']);setCell(cl,'Z4','TuinBooks ID');setCell(cl,'AA4','TuinBooks Team ID');data.clients.slice(0,400).forEach((c,i)=>{const r=i+5,tm=data.teams.find(t=>t.id===c.teamId)||data.teams.find(t=>t.id===c.preferredTeamId)||null;[['A',c.name],['B',c.status==='archived'?'Archived':c.status==='suspended'?'Suspended':'Active'],['C',c.contact||''],['D',c.whatsapp||c.phone||''],['E',c.email||''],['F',c.address||''],['G',c.suburb||''],['H',frequency(c.frequency)],['I',c.preferredDay||''],['J',tm?.name||''],['K',c.gardenNotes||''],['Z',c.id],['AA',tm?.id||'']].forEach(([col,v])=>setCell(cl,`${col}${r}`,v))});hiddenCols(cl,404);
 const cs=docs['Client Services'];clearCells(cs,5,1004,['A','B','C','Z','AA']);setCell(cs,'Z4','TuinBooks Client ID');setCell(cs,'AA4','TuinBooks Service ID');data.clientServices.slice(0,1000).forEach((x,i)=>{const r=i+5;setCell(cs,`A${r}`,x.client.name);setCell(cs,`B${r}`,x.service.name);setCell(cs,`C${r}`,x.notes||'');setCell(cs,`Z${r}`,x.client.id);setCell(cs,`AA${r}`,x.service.id||'')});hiddenCols(cs,1004);
 const sc=docs.Schedule;clearCells(sc,5,1204,['A','B','C','D','E','F','Z','AA','AB']);setCell(sc,'A2',`Week 1 represents Monday ${data.start}.`);setCell(sc,'Z4','TuinBooks Client ID');setCell(sc,'AA4','TuinBooks Team ID');setCell(sc,'AB4','TuinBooks Schedule ID');data.scheduleRows.slice(0,1200).forEach((x,i)=>{const r=i+5;setCell(sc,`A${r}`,x.week);setCell(sc,`B${r}`,x.day);setCell(sc,`C${r}`,x.client.name);setCell(sc,`D${r}`,x.team?.name||'');setCell(sc,`E${r}`,x.startTime||'');setCell(sc,`F${r}`,x.notes||'');setCell(sc,`Z${r}`,x.client.id);setCell(sc,`AA${r}`,x.team?.id||'');setCell(sc,`AB${r}`,x.scheduleId||'')});hiddenCols(sc,1204);
 const bpd=docs['Billing Profiles'];clearCells(bpd,5,54,['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','Z']);setCell(bpd,'Z4','TuinBooks ID');data.profiles.slice(0,50).forEach((p,i)=>{const r=i+5;[['A',p.displayName||p.legalName],['B',p.legalName||''],['C',p.tradingName||''],['D',p.registrationNumber||''],['E',p.vatRegistered?'Yes':'No'],['F',p.vatNumber||''],['G',p.email||''],['H',p.phone||''],['I',p.website||''],['J',p.billingAddress||''],['K',''],['L',p.defaultPaymentTerms||''],['M',p.bankName||''],['N',p.bankAccountHolder||''],['O',p.bankAccountNumber||''],['P',p.bankBranchCode||''],['Q',p.bankAccountType||''],['R',p.paymentReferenceNote||''],['S',p.invoicePrefix||'INV'],['T',p.quotePrefix||'QUO'],['U',p.documentFooter||''],['Z',p.id]].forEach(([col,v])=>setCell(bpd,`${col}${r}`,v))});hiddenCols(bpd,54);
 const cbd=docs['Client Billing'];clearCells(cbd,5,404,['A','B','C','D','E','F','Z','AA']);setCell(cbd,'Z4','TuinBooks Client ID');setCell(cbd,'AA4','TuinBooks Billing Profile ID');data.billing.slice(0,400).forEach((c,i)=>{const r=i+5,p=data.profiles.find(x=>x.id===c.billingProfileIdV59396)||null,monthly=key(c.billingArrangement).includes('monthly')||key(c.priceBasis).includes('monthly'),amount=monthly?Number(c.monthlyFee||c.rateAmount||0):Number(c.rateAmount||0);[['A',c.name],['B',p?.displayName||''],['C',monthly?'Monthly Fixed':'Per Visit'],['D',amount],['E',''],['F',c.billingNotes||''],['Z',c.id],['AA',p?.id||'']].forEach(([col,v])=>setCell(cbd,`${col}${r}`,v))});hiddenCols(cbd,404);
 for(const [name,path] of Object.entries(paths))if(docs[name])files.set(path,encText(sheetXmlText(docs[name])));return paths}
function bytesToDataUrl(bytes,mime){let bin='';const step=0x8000;for(let i=0;i<bytes.length;i+=step)bin+=String.fromCharCode(...bytes.subarray(i,i+step));return `data:${mime};base64,${btoa(bin)}`}
async function workbookMedia(file){try{const files=await unzipWorkbook(await file.arrayBuffer()),items=[...files.entries()].filter(([n])=>/^xl\/media\//i.test(n)&&/\.(png|jpe?g|webp)$/i.test(n));if(!items.length)return[];items.sort((a,b)=>(/tuinbooks-logo/i.test(b[0])?1:0)-(/tuinbooks-logo/i.test(a[0])?1:0)||b[1].length-a[1].length);return items.map(([n,b])=>bytesToDataUrl(b,/\.png$/i.test(n)?'image/png':/\.webp$/i.test(n)?'image/webp':'image/jpeg'))}catch(e){console.warn('[business workbook] logo read',e);return[]}}
async function logoPng(dataUrl){if(!/^data:image\//i.test(String(dataUrl||'')))return null;const img=new Image();img.src=dataUrl;await img.decode();const max=700,scale=Math.min(1,max/Math.max(img.naturalWidth||1,img.naturalHeight||1)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));return blob?new Uint8Array(await blob.arrayBuffer()):null}
function injectLogo(files,setupPath,png){if(!png?.length)return;let sheet=bytesText(files.get(setupPath));if(!/xmlns:r=/.test(sheet))sheet=sheet.replace('<worksheet ','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');sheet=sheet.replace(/<drawing\b[^>]*\/?>(?:<\/drawing>)?/g,'').replace('</worksheet>','<drawing r:id="rIdTuinBooksLogo"/></worksheet>');files.set(setupPath,encText(sheet));const base=setupPath.split('/').pop(),rels=`xl/worksheets/_rels/${base}.rels`,rel=`<Relationship Id="rIdTuinBooksLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/tuinbooks-logo.xml"/>`;let rx=files.has(rels)?bytesText(files.get(rels)):'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';if(!/rIdTuinBooksLogo/.test(rx))rx=rx.replace('</Relationships>',`${rel}</Relationships>`);files.set(rels,encText(rx));files.set('xl/drawings/tuinbooks-logo.xml',encText(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="TuinBooks Business Logo"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`));files.set('xl/drawings/_rels/tuinbooks-logo.xml.rels',encText('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/tuinbooks-logo.png"/></Relationships>'));files.set('xl/media/tuinbooks-logo.png',png);let ct=bytesText(files.get('[Content_Types].xml'));if(!/Extension="png"/.test(ct))ct=ct.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');if(!/PartName="\/xl\/drawings\/tuinbooks-logo.xml"/.test(ct))ct=ct.replace('</Types>','<Override PartName="/xl/drawings/tuinbooks-logo.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');files.set('[Content_Types].xml',encText(ct))}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}function zipStore(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;const w16=(dv,o,v)=>dv.setUint16(o,v,true),w32=(dv,o,v)=>dv.setUint32(o,v>>>0,true);for(const [name,content] of files){const nb=enc.encode(name),db=content instanceof Uint8Array?content:enc.encode(content),crc=crc32(db),lh=new Uint8Array(30+nb.length),ld=new DataView(lh.buffer);w32(ld,0,0x04034b50);w16(ld,4,20);w16(ld,6,0);w16(ld,8,0);w16(ld,10,0);w16(ld,12,0);w32(ld,14,crc);w32(ld,18,db.length);w32(ld,22,db.length);w16(ld,26,nb.length);w16(ld,28,0);lh.set(nb,30);locals.push(lh,db);const ch=new Uint8Array(46+nb.length),cd=new DataView(ch.buffer);w32(cd,0,0x02014b50);w16(cd,4,20);w16(cd,6,20);w16(cd,8,0);w16(cd,10,0);w16(cd,12,0);w16(cd,14,0);w32(cd,16,crc);w32(cd,20,db.length);w32(cd,24,db.length);w16(cd,28,nb.length);w16(cd,30,0);w16(cd,32,0);w16(cd,34,0);w16(cd,36,0);w32(cd,38,0);w32(cd,42,offset);ch.set(nb,46);centrals.push(ch);offset+=lh.length+db.length}const centralSize=centrals.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),ed=new DataView(end.buffer);w32(ed,0,0x06054b50);w16(ed,4,0);w16(ed,6,0);w16(ed,8,files.length);w16(ed,10,files.length);w32(ed,12,centralSize);w32(ed,16,offset);w16(ed,20,0);return new Blob([...locals,...centrals,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
async function buildExportBlob(){const res=await fetch(TEMPLATE,{cache:'no-store'});if(!res.ok)throw new Error('The TuinBooks workbook template could not be loaded.');const files=await unzipWorkbook(await res.arrayBuffer()),data=exportData(),paths=populateTemplate(files,data),logo=data.s.business?.logoDataUrl||data.s.business?.logoDataUrlV60432||'';if(logo){try{const png=await logoPng(logo);injectLogo(files,paths.Setup,png)}catch(e){console.warn('[business workbook] logo export',e)}}return zipStore([...files.entries()])}
async function exportWorkbook(){const blob=await buildExportBlob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(state()?.business?.name||'TuinBooks').replace(/[^A-Za-z0-9_-]+/g,'_')}_Business_Workbook.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toastMsg('Business workbook exported.')}
function downloadBlank(){const a=document.createElement('a');a.href=TEMPLATE;a.download='TuinBooks_Business_Workbook.xlsx';a.click();}
let current=null,currentFile=null,importInFlight=false;
function hostBusinessName(){return clean(state()?.business?.name)||'Current TuinBooks business';}
function hostReady(){return Boolean(hostWindow()&&runtime()?.getState?.()&&hostWindow()?.__tuinbooksOnboardingMasterImportV60420?.parseXlsxV60420);}
function firstLiveMonday(){const now=new Date(),day=now.getDay(),delta=day===1?0:(8-day)%7,mon=new Date(now);mon.setDate(now.getDate()+delta);return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;}
function importMode(){return document.querySelector('input[name="bwImportMode"]:checked')?.value||'merge';}
function setDisabled(disabled){['bwExportCurrent','bwFile','bwWeek1','bwCommit'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=disabled||(id==='bwCommit'&&!current);});document.querySelectorAll('input[name="bwImportMode"]').forEach(el=>el.disabled=disabled);}
function renderHost(){const el=document.getElementById('bwHostStatus');if(!el)return;if(!hostReady()){el.innerHTML='<strong>Not connected to TuinBooks.</strong><span>Close this window and open Import / Export from TuinBooks Settings.</span>';el.className='host-status bad';setDisabled(true);return;}el.innerHTML=`<strong>${esc(hostBusinessName())}</strong><span>Connected to the current TuinBooks business.</span>`;el.className='host-status ok';setDisabled(false);}
const attentionLabels={
 'business':'Business details','client-details':'Client details','client-planning':'Client planning','client-services':'Client services','schedule':'Schedule','billing-profile':'Billing Profiles','billing-cycle':'Business invoice cycle','client-billing':'Client billing'
};
function attentionSummary(items=[]){const groups=new Map();items.forEach(item=>{const k=item.category||'other';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);});return [...groups.entries()].map(([category,rows])=>{const first=rows[0],names=rows.map(x=>x.clientName||x.profileName||'').filter(Boolean),sample=names.slice(0,5).join(', ');return `<div class="attention-group"><div><strong>${esc(attentionLabels[category]||first.title||'Needs attention')}</strong><span>${rows.length} item${rows.length===1?'':'s'}${sample?` · ${esc(sample)}${names.length>5?'…':''}`:''}</span></div><small>${esc((first.steps||[]).join(' → '))}</small></div>`;}).join('');}
function renderPreview(){
 const host=document.getElementById('bwPreview'),commit=document.getElementById('bwCommit');if(!host||!current)return;
 const blockers=current.blockingIssues||current.issues||[],attention=current.attention||[],ready=!blockers.length,status=ready?(attention.length?'READY TO IMPORT · NEEDS ATTENTION':'READY TO IMPORT'):'FIX BEFORE IMPORT';
 const teamNames=current.teams.map(r=>clean(get(r,'Team Name'))).filter(Boolean);
 host.innerHTML=`<div class="preview-status ${ready?(attention.length?'attention':'ok'):'bad'}"><strong>${status}</strong><span>${esc(current.businessName)} · ${esc(current.mode)}</span></div><div class="counts"><span><b>${current.clients.length}</b> client/site records</span><span><b>${current.teams.length}</b> teams${teamNames.length?` · ${esc(teamNames.join(' + '))}`:''}</span><span><b>${current.services.length}</b> services</span><span><b>${current.schedule.length}</b> visits</span>${current.financial?`<span><b>${current.billProfiles.length}</b> billing profiles</span>`:''}</div>${blockers.length?`<div class="issue-list blocking"><strong>${blockers.length} item${blockers.length===1?'':'s'} must be fixed before import</strong><ul>${blockers.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${attention.length?`<div class="attention-summary"><div class="attention-summary-head"><strong>${attention.length} item${attention.length===1?'':'s'} will go to Business → Needs attention</strong><span>They do not stop this import.</span></div>${attentionSummary(attention)}</div>`:''}${current.warnings.length?`<div class="issue-list note"><strong>Import notes</strong><ul>${current.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}`;
 if(commit)commit.disabled=!ready;
}
function week1FromWorkbook(parsed){try{const row=(rowsFor(parsed,'Schedule')||[])[1]||[];const text=clean(row[0]);const m=text.match(/Monday\s+(\d{4}-\d{2}-\d{2})/i);return m&&mondayISO(m[1])?m[1]:'';}catch(_){return'';}}
async function readFile(file){if(!file)return;currentFile=file;const date=document.getElementById('bwWeek1');try{toastMsg('Checking workbook…');const parsed=await getParser()(file);parsed.fileName=file.name;parsed._media=[];const embedded=week1FromWorkbook(parsed),firstLive=firstLiveMonday();if(date){if(embedded&&embedded>=firstLive)date.value=embedded;else if(!date.value||date.value<firstLive)date.value=firstLive;}current=model(parsed,date?.value||'');renderPreview();const blockers=current.blockingIssues||[],attention=current.attention||[];if(blockers.length)toastMsg(`${blockers.length} structural item${blockers.length===1?'':'s'} must be fixed before import.`,'error');else if(attention.length)toastMsg(`Workbook can be imported. ${attention.length} item${attention.length===1?'':'s'} will appear under Business → Needs attention.`,'success');else toastMsg('Workbook is ready to import.','success');}catch(e){current=null;const host=document.getElementById('bwPreview');if(host)host.textContent='The workbook could not be checked.';const c=document.getElementById('bwCommit');if(c)c.disabled=true;toastMsg(e.message||String(e),'error');}}
async function runExport(){const b=document.getElementById('bwExportCurrent');if(!hostReady())return renderHost();const old=b?.textContent;if(b){b.disabled=true;b.textContent='Exporting…';}try{await exportWorkbook();toastMsg('Business workbook exported.','success');}catch(e){console.error('[v60.7.4 export]',e);toastMsg(e.message||String(e),'error');}finally{if(b){b.disabled=false;b.textContent=old;}}}
async function runImport(){
 if(importInFlight){toastMsg('An import is already running. Wait for it to finish.','error');return;}
 const blockers=current?.blockingIssues||current?.issues||[];if(!current||blockers.length)return;
 const replaceClients=importMode()==='replace';
 if(replaceClients&&current.week1<firstLiveMonday()){toastMsg(`For a replacement import, Week 1 must be the first live Monday (${firstLiveMonday()} or later). This prevents past visits being imported as missed work.`,'error');return;}
 if(replaceClients){const ok=window.confirm(`Replace the current client setup for ${hostBusinessName()}?\n\nThe workbook will become the current client list. Clients and teams not in the workbook will be retired, and all unresolved future scheduling for these clients will be rebuilt from the workbook. Completed, cancelled, missed and historically worked visits remain as history.`);if(!ok)return;}
 const b=document.getElementById('bwCommit');importInFlight=true;setDisabled(true);if(b){b.disabled=true;b.textContent=replaceClients?'Replacing client data…':'Importing…';}
 toastMsg(replaceClients?'Import started. Validating and replacing data in one database transaction…':'Import started. Validating and saving data…');
 try{const r=await apply(current,{replaceClients});const extra=r.attention?` ${r.attention} item${r.attention===1?'':'s'} are now listed under Business → Needs attention.`:'';toastMsg(`${replaceClients?'Replaced client setup and imported':'Imported'} ${r.clients} client/site records, ${r.teams} teams and ${r.visits} standard visits${r.serverMs?` · database ${Math.max(0.1,r.serverMs/1000).toFixed(1)}s`:''}.${extra}`,'success');current=null;currentFile=null;const f=document.getElementById('bwFile');if(f)f.value='';const p=document.getElementById('bwPreview');if(p)p.innerHTML=`<div class="empty-preview"><strong>Import complete.</strong>${r.attention?` ${r.attention} item${r.attention===1?'':'s'} can be worked through under <strong>Business → Needs attention</strong>.`:''}</div>`;if(b)b.disabled=true;}catch(e){console.error('[v60.7.4 import]',e);toastMsg(e.message||String(e),'error');}finally{importInFlight=false;setDisabled(false);if(b){b.textContent='Import business';b.disabled=!current||Boolean((current?.blockingIssues||current?.issues||[]).length);}}
}
function install(){
 window.__tuinbooksBusinessWorkbookV6074={build:BUILD,model,apply,exportWorkbook,buildExportBlob,downloadBlank,hostReady};
 const week=document.getElementById('bwWeek1');if(week&&!week.value)week.value=firstLiveMonday();
 document.getElementById('bwDownloadBlank')?.addEventListener('click',downloadBlank);
 document.getElementById('bwExportCurrent')?.addEventListener('click',runExport);
 document.getElementById('bwFile')?.addEventListener('change',e=>readFile(e.target.files?.[0]));
 week?.addEventListener('change',()=>{if(currentFile)readFile(currentFile)});
 document.querySelectorAll('input[name="bwImportMode"]').forEach(el=>el.addEventListener('change',renderPreview));
 document.getElementById('bwCommit')?.addEventListener('click',runImport);
 document.getElementById('bwClose')?.addEventListener('click',()=>window.close());
 renderHost();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
