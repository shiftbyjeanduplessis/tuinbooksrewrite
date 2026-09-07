(() => {
'use strict';
const BUILD='60.4.30-owner-mobile-visual-polish';
const PROFILE_LABELS={field_worker:'Field Worker',owner_mobile:'Owner Mobile',estimator:'Estimator'};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`R ${Number(n||0).toLocaleString('en-ZA',{minimumFractionDigits:0,maximumFractionDigits:2})}`;

const ICONS={
  work:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  quote:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/>',
  refresh:'<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  chevronLeft:'<path d="m15 18-6-6 6-6"/>',
  chevronRight:'<path d="m9 18 6-6-6-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  circle:'<circle cx="12" cy="12" r="8"/>',
  stop:'<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>',
  cancelled:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  alert:'<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  sold:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  invoice:'<path d="M6 2h9l4 4v16l-3-2-3 2-3-2-3 2-3-2V4a2 2 0 0 1 2-2z"/><path d="M8 8h7M8 12h7M8 16h4"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
  message:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  client:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2.2"/><path d="M5.8 16c.8-2 2-3 3.2-3s2.4 1 3.2 3M14 9h4M14 13h4"/>',
  team:'<path d="M3 13h4l2-5h7l2 5h3"/><path d="M5 13v5h14v-5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'
};
function icon(name,size=18,cls=''){
  const body=ICONS[name]||ICONS.circle;
  return `<svg class="mp30-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmtDate=(iso,weekday=true)=>iso?new Date(`${String(iso).slice(0,10)}T12:00:00`).toLocaleDateString('en-ZA',{weekday:weekday?'short':undefined,day:'numeric',month:'short'}):'—';
const backend=()=>window.backendV28;
let profile='';
let workspace=null;
let currentTab='';
let weekOffset=0;
let selectedDate='';
let refreshing=false;
let quoteFilter='current';
let invoiceFilter='debtors';
let clientFilter='active';
let quoteLines=[newLine()];
let invoiceLines=[newLine()];

function newLine(){return {itemCode:'',accountingCode:'',description:'',unit:'',qty:1,unitPrice:0};}
function lower(v){return String(v||'').trim().toLowerCase();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function clientMap(){return new Map((workspace?.clients||[]).map(c=>[String(c.id),c]));}
function teamMap(){return new Map((workspace?.teams||[]).map(t=>[String(t.id),t]));}
function clientPayload(c){return c?.payload&&typeof c.payload==='object'?c.payload:{};}
function clientDnsV18(c){const p=clientPayload(c);return c?.doNotServiceV6053===true||p?.doNotServiceV6053===true;}
function visitDnsV18(j){const p=j?.payload&&typeof j.payload==='object'?j.payload:{};return j?.doNotServiceVisitR18===true||p?.doNotServiceVisitR18===true||p?.doNotServiceVisitV2===true;}
function clientFrequency(c){return c?.frequency||clientPayload(c).frequency||'Not set';}
function clientMonthlyFee(c){return num(c?.monthly_fee||clientPayload(c).monthlyFee);}
function clientTeamId(c){return String(c?.team_id||clientPayload(c).teamId||clientPayload(c).preferredTeamId||'');}
function activeClients(){return (workspace?.clients||[]).filter(c=>String(c.status||'active')!=='archived');}
function lineItems(doc){const p=doc?.payload||{};return Array.isArray(p.lineItems)?p.lineItems:Array.isArray(doc?.lineItems)?doc.lineItems:[];}
function docTotal(doc){return lineItems(doc).reduce((s,l)=>s+num(l.qty)*num(l.unitPrice),0)||num(doc?.total||doc?.payload?.total);}
function quoteNumber(q){return q?.payload?.number||q?.payload?.quoteNumber||'Draft quote';}
function invoiceNumber(i){return i?.invoice_number||i?.payload?.number||'Draft';}
function workScheduleId(w){return String(w?.schedule_job_id||w?.payload?.scheduledJobId||'');}
function normalizedStatus(v){return lower(v).replace(/[_-]+/g,' ');}
function isDoneJob(j,workIds){return normalizedStatus(j?.status)==='completed'||workIds.has(String(j?.id));}
function weekStart(){const d=new Date();let day=d.getDay()||7;d.setDate(d.getDate()-(day-1)+(weekOffset*7));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function currentWeekDates(){const start=weekStart();return Array.from({length:7},(_,i)=>addDays(start,i));}
function nextVisitFor(clientId){return (workspace?.schedules||[]).filter(j=>String(j.client_id)===String(clientId)&&String(j.visit_date)>=isoToday()&&!['cancelled','completed'].includes(normalizedStatus(j.status))).sort((a,b)=>String(a.visit_date).localeCompare(String(b.visit_date)))[0]||null;}
function outstandingFor(clientId){return (workspace?.invoices||[]).filter(i=>String(i.client_id)===String(clientId)&&!invoicePaid(i)&&normalizedStatus(i.status)!=='credited').reduce((s,i)=>s+docTotal(i),0);}
function invoicePaid(i){return ['paid','credited'].includes(normalizedStatus(i?.status))||normalizedStatus(i?.payload?.paymentStatus)==='paid';}
function invoiceSent(i){const s=normalizedStatus(i?.status),d=normalizedStatus(i?.payload?.deliveryStatus);return !['draft','ready'].includes(s)||d==='sent'||Boolean(i?.payload?.sentAt);}
function itemLibrary(){return (workspace?.items||[]).filter(i=>i.active!==false);}
function itemMatch(value){const q=lower(value);return itemLibrary().find(i=>[i.item_code,i.accounting_code,i.description].some(x=>lower(x)===q))||null;}
function financeData(){return workspace?.finance&&typeof workspace.finance==='object'?workspace.finance:{};}
function isSoldQuote(q){
  const p=q?.payload||{},s=normalizedStatus(q?.status);
  return Boolean(p.acceptedAt||p.approvedAt||p.convertedAtV58940||p.convertedToV58940)
    ||['accepted','approved','scheduled','converted','completed','sold'].includes(s);
}
function quoteClosed(q){
  const s=normalizedStatus(q?.status);
  return ['declined','cancelled','expired','voided'].includes(s)||isSoldQuote(q);
}
function teamTone(teamId){
  const teams=(workspace?.teams||[]).map(t=>String(t.id));
  const idx=Math.max(0,teams.indexOf(String(teamId)));
  return `mp29-team-tone-${idx%6}`;
}
function jobViewStatus(j,workIds,c){
  if(visitDnsV18(j)||clientDnsV18(c)||lower(c?.status)==='paused')return {icon:'stop',label:'DO NOT SERVICE',cls:'stop'};
  const s=normalizedStatus(j?.status);
  if(s==='cancelled')return {icon:'cancelled',label:'CANCELLED',cls:'cancelled'};
  if(isDoneJob(j,workIds))return {icon:'check',label:'COMPLETE',cls:'done'};
  return {icon:'circle',label:'TO DO',cls:'todo'};
}
function salesBarHtml(){
  const f=financeData(),m=f.month||{};
  const quoted=num(m.quoted),sold=num(m.sold),invoiced=num(m.invoiced),max=Math.max(quoted,sold,invoiced,1);
  const bar=(label,value,cls,iconName)=>`<div class="mp30-sales-row"><div class="mp30-sales-label"><span class="mp30-metric-icon ${cls}">${icon(iconName,15)}</span><span>${label}</span><strong>${money(value)}</strong></div><div class="mp30-sales-track"><i class="${cls}" style="width:${value?Math.max(4,Math.round(value/max*100)):0}%"></i></div></div>`;
  return `<section class="mp30-sales-card"><header><div class="mp30-card-title"><span class="mp30-title-icon">${icon('trend',18)}</span><div><span class="mp28-eyebrow">This month</span><h2>Sales snapshot</h2></div></div><small>${esc(m.label||'')}</small></header>${bar('Quoted',quoted,'quoted','quote')}${bar('Sold',sold,'sold','sold')}${bar('Invoiced',invoiced,'invoiced','invoice')}<footer><div><span>${icon('clock',15)} Outstanding this month</span><strong>${money(m.outstanding)}</strong></div><div><span>${icon('wallet',15)} Total debtors</span><strong>${money(f.outstanding_total)}</strong></div></footer></section>`;
}

function setupPairingProfileUI(){
  const select=$('mobilePairingProfileV60424'),teamWrap=$('mobilePairingTeamWrapV60424'),team=$('mobilePairingTeam'),help=$('mobilePairingProfileHelpV60424');
  if(!select||select.dataset.boundV60428)return;
  select.dataset.boundV60428='1';
  [...select.options].forEach(o=>{if(!PROFILE_LABELS[o.value])o.remove();});
  const apply=()=>{const p=select.value,field=p==='field_worker';if(teamWrap)teamWrap.classList.toggle('mobile-profile-team-hidden-v60428',!field);if(team)team.required=true;if(help)help.textContent=field?'Assigned route only. Complete visits, add photos and report opportunities.':p==='owner_mobile'?'Owner information app: team routes, clients, sales, quotes, invoices and debtors.':'Quote-focused app for site visits and estimates.';};
  select.addEventListener('change',apply);apply();
}

function ensureShell(){
  let shell=$('mobileOwnerShellV60428');if(shell)return shell;
  shell=document.createElement('div');shell.id='mobileOwnerShellV60428';shell.className='mp28-shell hidden';
  shell.innerHTML=`<header class="mp28-header mp30-header"><div class="mp30-brand-lockup"><span class="mp30-brand-mark">${icon('work',18)}</span><div><span class="mp28-eyebrow">TuinBooks mobile</span><strong id="mp28Business">TuinBooks</strong><small id="mp28Profile"></small></div></div><button id="mp28Refresh" class="mp30-icon-button" type="button" aria-label="Refresh">${icon('refresh',19)}</button></header><div id="mp28RefreshState" class="mp28-refresh-state hidden">${icon('refresh',14)} Refreshing…</div><main id="mp28Body" class="mp28-body"><section class="mp28-loading"><div class="mp28-spinner"></div><strong>Opening your workspace…</strong></section></main><nav id="mp28Nav" class="mp28-nav mp30-nav"></nav>`;
  const gate=document.querySelector('.backend-gate');if(gate)gate.after(shell);else document.body.prepend(shell);
  $('mp28Refresh').onclick=()=>loadWorkspace(true);
  return shell;
}
function navItems(){return profile==='owner_mobile'?[['work','Work'],['clients','Clients'],['quotes','Quotes'],['billing','Money']]:profile==='estimator'?[['quotes','Quotes'],['clients','Clients']]:[];}
function renderChrome(){
  const shell=ensureShell();shell.classList.remove('hidden');document.querySelector('.mobile-shell')?.classList.add('mp28-field-hidden');document.body.classList.remove('mobile-profile-resolving-v60428');
  $('mp28Business').textContent=workspace?.business?.name||'TuinBooks';$('mp28Profile').textContent=PROFILE_LABELS[profile]||profile;
  const navIcon={work:'work',clients:'users',quotes:'quote',billing:'wallet'};const items=navItems(),nav=$('mp28Nav');nav.innerHTML=items.map(([id,label])=>`<button type="button" data-tab="${id}" class="${id===currentTab?'active':''}"><span class="mp28-nav-icon">${icon(navIcon[id]||'circle',20)}</span><span>${label}</span></button>`).join('');nav.querySelectorAll('button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
}
function showTab(tab){currentTab=tab||navItems()[0]?.[0]||'quotes';renderChrome();if(currentTab==='work')renderWork();else if(currentTab==='clients')renderClients();else if(currentTab==='quotes')renderQuotes();else if(currentTab==='billing')renderBilling();window.scrollTo({top:0,behavior:'instant'});}
function setRefreshUI(on){refreshing=on;$('mp28RefreshState')?.classList.toggle('hidden',!on);$('mp28Refresh')?.classList.toggle('spinning',on);}

function renderWork(){
  const body=$('mp28Body'),cm=clientMap(),tm=teamMap(),workIds=new Set((workspace?.work||[]).map(workScheduleId).filter(Boolean));
  if(!selectedDate)selectedDate=isoToday();
  const rows=(workspace?.schedules||[]).filter(j=>String(j.visit_date)===selectedDate)
    .sort((a,b)=>String(a.team_id).localeCompare(String(b.team_id))||num(a.sort_order)-num(b.sort_order));
  const completed=rows.filter(j=>isDoneJob(j,workIds)).length;
  const todo=rows.filter(j=>!isDoneJob(j,workIds)&&normalizedStatus(j.status)!=='cancelled'&&lower(cm.get(String(j.client_id))?.status)!=='paused').length;
  const missed=(workspace?.schedules||[]).filter(j=>String(j.visit_date)<isoToday()&&!['completed','cancelled','missed','rescheduled'].includes(normalizedStatus(j.status))&&!workIds.has(String(j.id)));
  const opps=(workspace?.opportunities||[]).filter(o=>['new','needs review','pending'].includes(normalizedStatus(o.status||o.review_decision)));
  const teamIds=[...new Set(rows.map(r=>String(r.team_id)))];

  body.innerHTML=`${profile==='owner_mobile'?salesBarHtml():''}<section class="mp30-page-title"><span class="mp30-page-icon">${icon('calendar',21)}</span><div><span class="mp28-eyebrow">Work & route</span><h1>${fmtDate(selectedDate,false)}</h1><p>${rows.length} visits · ${completed} complete · ${todo} still to do</p></div></section><div class="mp29-day-nav mp30-day-nav"><button id="mp29PrevDay" type="button">${icon('chevronLeft',17)}<span>Previous</span></button><button id="mp29Today" type="button" class="${selectedDate===isoToday()?'active':''}">${icon('calendar',16)}<span>Today</span></button><button id="mp29NextDay" type="button"><span>Next</span>${icon('chevronRight',17)}</button></div><div id="mp29TeamLists"></div>${selectedDate===isoToday()?`<section class="mp28-attention mp30-attention ${missed.length||opps.length?'has-attention':''}"><span class="mp30-attention-icon">${icon('alert',18)}</span><div><strong>Needs attention</strong><span>${missed.length} missed · ${opps.length} opportunities</span></div></section>`:''}`;

  const host=$('mp29TeamLists');
  host.innerHTML=teamIds.length?teamIds.map(teamId=>{
    const team=tm.get(teamId)||{},jobs=rows.filter(r=>String(r.team_id)===teamId),done=jobs.filter(j=>isDoneJob(j,workIds)).length;
    return `<section class="mp29-team-list mp30-team-card ${teamTone(teamId)}"><header><div class="mp30-team-name"><span class="mp30-team-icon">${icon('team',18)}</span><div><strong>${esc(team.name||'Team')}</strong><span>${done} of ${jobs.length} complete</span></div></div><b><span>${jobs.length-done}</span> left</b></header><div class="mp30-team-progress"><i style="width:${jobs.length?Math.round(done/jobs.length*100):0}%"></i></div><div class="mp29-job-list">${jobs.map((j,i)=>{
      const c=cm.get(String(j.client_id))||{},s=jobViewStatus(j,workIds,c),m=markerForJob(j,c);
      return `<article class="mp29-job-row mp30-job-row ${s.cls}"><span class="mp29-job-icon">${icon(s.icon,17)}</span><div><strong>${esc(c.name||'Client')}</strong><span>${esc(c.address||'')}${c.suburb?` · ${esc(c.suburb)}`:''}</span><small><span class="mp30-job-order">${i+1}</span><span class="mp30-job-type ${m.cls}">${esc(m.label)}</span><span class="mp30-job-status">${esc(s.label)}</span></small></div></article>`;
    }).join('')}</div></section>`;
  }).join(''):`<div class="mp28-empty"><strong>Open day.</strong><span>No visits scheduled for ${fmtDate(selectedDate,false)}.</span></div>`;

  $('mp29PrevDay').onclick=()=>{selectedDate=addDays(selectedDate,-1);renderWork();};
  $('mp29NextDay').onclick=()=>{selectedDate=addDays(selectedDate,1);renderWork();};
  $('mp29Today').onclick=()=>{selectedDate=isoToday();renderWork();};
}

function markerForJob(j,c){if(visitDnsV18(j)||clientDnsV18(c)||String(c?.status)==='paused')return {label:'DO NOT SERVICE',cls:'stop'};const p=j?.payload||{},rev=lower(p.revenueType||p.workKind||'');if(p.quoteId||p.quote_id||rev.includes('add-on')||rev.includes('additional')||rev.includes('extra'))return {label:'EXTRA',cls:'extra'};if(rev.includes('once')||rev.includes('direct'))return {label:'O',cls:'once'};return {label:'R',cls:'routine'};}
function renderSchedule(){
  const body=$('mp28Body'),cm=clientMap(),tm=teamMap(),dates=currentWeekDates();if(!selectedDate||!dates.includes(selectedDate))selectedDate=dates.includes(isoToday())?isoToday():dates[0];
  const rows=(workspace?.schedules||[]).filter(j=>String(j.visit_date)===selectedDate).sort((a,b)=>String(a.team_id).localeCompare(String(b.team_id))||num(a.sort_order)-num(b.sort_order));
  body.innerHTML=`<section class="mp28-page-head"><div><span class="mp28-eyebrow">Owner schedule</span><h1>${fmtDate(selectedDate,false)}</h1><p>Phone overview only. Full planning stays on desktop.</p></div></section><div class="mp28-week-nav"><button id="mp28PrevWeek">‹</button><button id="mp28TodayWeek">Today</button><strong>${fmtDate(dates[0],false)} – ${fmtDate(dates[5],false)}</strong><button id="mp28NextWeek">›</button></div><div class="mp28-day-strip">${dates.map(d=>{const count=(workspace?.schedules||[]).filter(j=>String(j.visit_date)===d).length;return `<button data-day="${d}" class="${d===selectedDate?'active':''}"><span>${new Date(`${d}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'short'})}</span><strong>${String(d).slice(8)}</strong><small>${count}</small></button>`;}).join('')}</div><div id="mp28DayRoute"></div>`;
  const host=$('mp28DayRoute'),teamIds=[...new Set(rows.map(r=>String(r.team_id)))];host.innerHTML=teamIds.length?teamIds.map(teamId=>{const t=tm.get(teamId)||{},jobs=rows.filter(r=>String(r.team_id)===teamId);return `<section class="mp28-section"><h2>${esc(t.name||'Team')} <span>${jobs.length} jobs</span></h2>${jobs.map((j,i)=>{const c=cm.get(String(j.client_id))||{},m=markerForJob(j,c);return `<article class="mp28-route-card ${m.cls}"><span class="mp28-route-order">${i+1}</span><div><strong>${esc(c.name||'Client')}</strong><span>${esc(c.address||'')}${c.suburb?` · ${esc(c.suburb)}`:''}</span><small>${esc(j.status||'scheduled')}</small></div><b>${esc(m.label)}</b></article>`;}).join('')}</section>`;}).join(''):'<div class="mp28-empty"><strong>Open day.</strong><span>No jobs scheduled for this date.</span></div>';
  body.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.day;renderSchedule();});$('mp28PrevWeek').onclick=()=>{weekOffset--;selectedDate='';renderSchedule();};$('mp28NextWeek').onclick=()=>{weekOffset++;selectedDate='';renderSchedule();};$('mp28TodayWeek').onclick=()=>{weekOffset=0;selectedDate=isoToday();renderSchedule();};
}

function clientRowsForDisplay(){const q=lower($('mp28ClientSearch')?.value),rows=activeClients().filter(c=>clientFilter==='all'||String(c.status||'active')===clientFilter).filter(c=>!q||lower(`${c.name} ${c.address} ${c.suburb} ${c.contact_name} ${c.phone}`).includes(q));return rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'}));}
function renderClients(){
  const body=$('mp28Body');body.innerHTML=`<section class="mp28-page-head mp30-page-head"><div class="mp30-card-title"><span class="mp30-page-icon">${icon('users',20)}</span><div><span class="mp28-eyebrow">Clients</span><h1>Find a client</h1></div></div>${profile==='owner_mobile'?`<button id="mp28ClientQuickInvoice" class="mp28-primary mp30-primary">${icon('plus',16)}<span>Invoice</span></button>`:''}</section><label class="mp30-search-wrap">${icon('search',18)}<input id="mp28ClientSearch" class="mp28-search" type="search" placeholder="Search name, address or phone"></label><div class="mp28-segment mp30-segment"><button data-client-filter="active">Active</button><button data-client-filter="paused">Paused</button><button data-client-filter="all">All</button></div><div id="mp28ClientList"></div>`;
  const draw=()=>{body.querySelectorAll('[data-client-filter]').forEach(b=>b.classList.toggle('active',b.dataset.clientFilter===clientFilter));const rows=clientRowsForDisplay();$('mp28ClientList').innerHTML=rows.map(c=>{const next=nextVisitFor(c.id),fee=clientMonthlyFee(c),team=teamMap().get(clientTeamId(c));return `<button class="mp28-client-row mp30-client-row ${(c.status==='paused'||clientDnsV18(c))?'paused':''}" data-client-id="${esc(c.id)}"><span class="mp30-client-icon">${icon((c.status==='paused'||clientDnsV18(c))?'stop':'client',18)}</span><div><strong>${esc(c.name||'Client')}</strong><span>${esc(c.address||'')}${c.suburb?` · ${esc(c.suburb)}`:''}</span><small>${esc(clientFrequency(c))}${team?` · ${esc(team.name)}`:''}${next?` · Next ${fmtDate(next.visit_date)}`:''}</small></div><b>${(c.status==='paused'||clientDnsV18(c))?'<span class="mp30-status-pill stop">DO NOT SERVICE</span>':fee?money(fee):icon('chevronRight',18)}</b></button>`;}).join('')||'<div class="mp28-empty"><strong>No matching clients.</strong></div>';$('mp28ClientList').querySelectorAll('[data-client-id]').forEach(b=>b.onclick=()=>openClient(b.dataset.clientId));};
  $('mp28ClientSearch').oninput=draw;body.querySelectorAll('[data-client-filter]').forEach(b=>b.onclick=()=>{clientFilter=b.dataset.clientFilter;draw();});if($('mp28ClientQuickInvoice'))$('mp28ClientQuickInvoice').onclick=()=>openQuickInvoice('');draw();
}
function openClient(id){
  const c=clientMap().get(String(id));if(!c)return;const team=teamMap().get(clientTeamId(c)),next=nextVisitFor(id),balance=outstandingFor(id);const recent=(workspace?.work||[]).filter(w=>String(w.client_id)===String(id)).sort((a,b)=>String(b.work_date).localeCompare(String(a.work_date))).slice(0,3),quotes=(workspace?.quotes||[]).filter(q=>String(q.client_id)===String(id)).slice(0,3);
  const dlg=dialog('mp28ClientDialog',`<div class="mp28-dialog-head"><div><span class="mp28-eyebrow">Client</span><h2>${esc(c.name||'Client')}</h2><p>${esc(c.address||'')}${c.suburb?` · ${esc(c.suburb)}`:''}</p></div><button data-close>×</button></div><div class="mp28-client-actions">${c.phone?`<a href="tel:${esc(c.phone)}">Call</a><a href="https://wa.me/${esc(String(c.phone).replace(/\D/g,''))}" target="_blank">WhatsApp</a>`:''}<button data-quote>Quote</button>${profile==='owner_mobile'?'<button data-invoice>Invoice</button>':''}</div>${(c.status==='paused'||clientDnsV18(c))?'<div class="mp28-stop-banner">⛔ DO NOT SERVICE · OFFICE HOLD</div>':''}<section class="mp28-detail-grid"><div><span>Service</span><strong>${esc(clientFrequency(c))}</strong><small>${clientMonthlyFee(c)?`${money(clientMonthlyFee(c))} routine fee`:'Routine fee not set'}</small></div><div><span>Team</span><strong>${esc(team?.name||'Not assigned')}</strong><small>${next?`Next ${fmtDate(next.visit_date)}`:'No future visit in loaded period'}</small></div><div><span>Outstanding</span><strong>${money(balance)}</strong><small>Open invoice value in this mobile view</small></div><div><span>Status</span><strong>${esc(String(c.status||'active').toUpperCase())}</strong><small>${esc(c.instructions||'')}</small></div></section><section class="mp28-section"><h2>Recent work</h2>${recent.map(w=>`<div class="mp28-detail-row"><span>${fmtDate(w.work_date)} · ${esc(w.outcome||'Completed')}</span></div>`).join('')||'<p class="mp28-muted">No recent work.</p>'}</section><section class="mp28-section"><h2>Recent quotes</h2>${quotes.map(q=>`<div class="mp28-detail-row"><span>${esc(quoteNumber(q))} · ${esc(q.status||'Draft')}</span><strong>${money(docTotal(q))}</strong></div>`).join('')||'<p class="mp28-muted">No recent quotes.</p>'}</section>`);
  dlg.querySelector('[data-close]').onclick=()=>dlg.close();dlg.querySelector('[data-quote]').onclick=()=>{dlg.close();openQuickQuote(id);};dlg.querySelector('[data-invoice]')?.addEventListener('click',()=>{dlg.close();openQuickInvoice(id);});dlg.showModal();
}

function statusChip(s){const v=normalizedStatus(s||'draft');const cls=v==='accepted'||v==='paid'?'good':v==='sent'?'sent':v==='declined'||v==='overdue'?'warn':'neutral';return `<b class="mp28-chip ${cls}">${esc(v.toUpperCase())}</b>`;}
function renderQuotes(){
  const body=$('mp28Body'),cm=clientMap();
  const all=(workspace?.quotes||[]).slice().sort((a,b)=>String(b.updated_at||b.quote_date||'').localeCompare(String(a.updated_at||a.quote_date||'')));
  const current=all.filter(q=>!quoteClosed(q));
  const sold=all.filter(isSoldQuote);
  const rows=quoteFilter==='current'?current:quoteFilter==='sold'?sold:all;

  body.innerHTML=`${profile==='owner_mobile'?salesBarHtml():''}<section class="mp28-page-head mp30-page-head"><div class="mp30-card-title"><span class="mp30-page-icon">${icon('quote',20)}</span><div><span class="mp28-eyebrow">Quotes</span><h1>${profile==='estimator'?'Estimator':'Quote history'}</h1><p>${profile==='owner_mobile'?'Current quotes, sales and complete quote history.':'Create and review quotes.'}</p></div></div><button id="mp28QuickQuote" class="mp28-primary mp30-primary">${icon('plus',16)}<span>Quick Quote</span></button></section><div class="mp28-segment mp29-three-tabs mp30-segment"><button data-q-filter="current">Current <small>${current.length}</small></button><button data-q-filter="sold">Sold <small>${sold.length}</small></button><button data-q-filter="history">${icon('history',14)} History <small>${all.length}</small></button></div><div id="mp28QuoteRows"></div>`;

  body.querySelectorAll('[data-q-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.qFilter===quoteFilter);b.onclick=()=>{quoteFilter=b.dataset.qFilter;renderQuotes();};});
  $('mp28QuickQuote').onclick=()=>openQuickQuote('');
  $('mp28QuoteRows').innerHTML=rows.map(q=>{
    const c=cm.get(String(q.client_id))||{},existing=Boolean(c.id)&&String(c.status||'archived')!=='archived';
    const p=q.payload||{},when=p.acceptedAt||p.approvedAt||q.quote_date||p.date||String(q.updated_at||'').slice(0,10);
    return `<article class="mp28-doc-card mp30-doc-card"><span class="mp30-doc-icon">${icon(isSoldQuote(q)?'sold':'quote',18)}</span><div><div class="mp28-doc-title"><strong>${esc(c.name||p.contactName||p.contact?.name||'Quick contact')}</strong><span class="mp28-type ${existing?'extra':'once'}">${existing?'EXTRA':'O'}</span></div><span>${esc(quoteNumber(q))} · ${fmtDate(String(when).slice(0,10))}</span><small>${esc(lineItems(q).map(l=>l.description).filter(Boolean).slice(0,2).join(' · ')||'No line description')}</small></div><div class="mp30-doc-money"><strong>${money(docTotal(q))}</strong>${statusChip(isSoldQuote(q)?'accepted':q.status)}</div></article>`;
  }).join('')||'<div class="mp28-empty"><strong>No quotes in this view.</strong></div>';
}

function renderBilling(){
  const body=$('mp28Body'),cm=clientMap(),f=financeData(),m=f.month||{};
  const all=(workspace?.invoices||[]).slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
  const paid=all.filter(invoicePaid);
  const debtors=Array.isArray(f.debtors)?f.debtors:[];
  const balanceMap=new Map((f.debtor_invoices||[]).map(i=>[String(i.id),i]));

  body.innerHTML=`<section class="mp28-page-head mp30-page-head"><div class="mp30-card-title"><span class="mp30-page-icon">${icon('wallet',20)}</span><div><span class="mp28-eyebrow">Money</span><h1>Debtors</h1><p>Who owes you money and what needs attention.</p></div></div><button id="mp28QuickInvoice" class="mp28-primary mp30-primary">${icon('plus',16)}<span>Quick Invoice</span></button></section><section class="mp29-money-summary mp30-money-summary"><div><span class="mp30-summary-icon invoiced">${icon('invoice',17)}</span><div><span>Invoiced this month</span><strong>${money(m.invoiced)}</strong></div></div><div class="alert"><span class="mp30-summary-icon outstanding">${icon('clock',17)}</span><div><span>Outstanding this month</span><strong>${money(m.outstanding)}</strong></div></div><div class="danger"><span class="mp30-summary-icon debt">${icon('alert',17)}</span><div><span>Total outstanding</span><strong>${money(f.outstanding_total)}</strong></div></div></section><div class="mp28-segment mp29-three-tabs mp30-segment"><button data-i-filter="debtors">${icon('users',14)} Debtors <small>${debtors.length}</small></button><button data-i-filter="invoices">${icon('invoice',14)} Invoices</button><button data-i-filter="paid">${icon('sold',14)} Paid</button></div><div id="mp28InvoiceRows"></div>`;

  $('mp28QuickInvoice').onclick=()=>openQuickInvoice('');
  body.querySelectorAll('[data-i-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.iFilter===invoiceFilter);b.onclick=()=>{invoiceFilter=b.dataset.iFilter;renderBilling();};});
  const host=$('mp28InvoiceRows');

  if(invoiceFilter==='debtors'){
    host.innerHTML=debtors.map(d=>{
      const overdue=num(d.overdue),phone=String(d.phone||'').trim(),digits=phone.replace(/\D/g,'');
      return `<article class="mp29-debtor-card mp30-debtor-card ${overdue>0?'overdue':''}"><button type="button" data-debtor-client="${esc(d.client_id)}"><span class="mp30-debtor-icon">${icon(overdue>0?'alert':'wallet',18)}</span><div><strong>${esc(d.client_name||'Client')}</strong><span>${overdue>0?`<span class="mp30-status-pill overdue">${money(overdue)} overdue</span>`:'Payment outstanding'}${d.oldest_due?` · oldest due ${fmtDate(d.oldest_due)}`:''}</span><small>${num(d.invoice_count)} open invoice${num(d.invoice_count)===1?'':'s'}${num(d.current_month_outstanding)>0?` · ${money(d.current_month_outstanding)} from this month`:''}</small></div><b>${money(d.outstanding)}</b></button>${phone?`<div class="mp29-debtor-actions"><a href="tel:${esc(phone)}">${icon('phone',15)}<span>Call</span></a><a href="https://wa.me/${esc(digits)}" target="_blank">${icon('message',15)}<span>WhatsApp</span></a></div>`:''}</article>`;
    }).join('')||'<div class="mp28-empty"><strong>No debtors to action.</strong><span>There are no issued invoices with an outstanding balance.</span></div>';
    host.querySelectorAll('[data-debtor-client]').forEach(b=>b.onclick=()=>openClient(b.dataset.debtorClient));
    return;
  }

  const rows=invoiceFilter==='paid'?paid:all;
  host.innerHTML=rows.map(i=>{
    const c=cm.get(String(i.client_id))||{},bal=balanceMap.get(String(i.id)),balance=bal?num(bal.balance):(invoicePaid(i)?0:docTotal(i));
    return `<article class="mp28-doc-card mp30-doc-card"><span class="mp30-doc-icon">${icon(balance<=.01?'sold':'invoice',18)}</span><div><strong>${esc(c.name||'Client')}</strong><span>${esc(invoiceNumber(i))} · ${fmtDate(i.payload?.issueDate||`${String(i.invoice_month||'').slice(0,7)}-01`)}</span><small>${balance>0?`${money(balance)} outstanding`:'Paid / settled'}</small></div><div class="mp30-doc-money"><strong>${money(docTotal(i))}</strong>${statusChip(balance<=.01?'paid':i.status)}</div></article>`;
  }).join('')||'<div class="mp28-empty"><strong>No invoices in this view.</strong></div>';
}

function dialog(id,html){let d=$(id);if(d)d.remove();d=document.createElement('dialog');d.id=id;d.className='mp28-dialog';d.innerHTML=`<div class="mp28-dialog-shell">${html}</div>`;document.body.appendChild(d);d.addEventListener('close',()=>setTimeout(()=>d.remove(),0),{once:true});return d;}
function contactFields(prefix){return `<div class="mp28-contact-grid"><label>Name / company<input id="${prefix}Name" maxlength="160"></label><label>Contact<input id="${prefix}Contact" maxlength="160"></label><label>Mobile / WhatsApp<input id="${prefix}Phone" inputmode="tel"></label><label>Email<input id="${prefix}Email" type="email"></label><label>Address<input id="${prefix}Address" maxlength="240"></label><label>Suburb<input id="${prefix}Suburb" maxlength="160"></label></div>`;}
function billingProfilesOptions(clientId=''){const c=clientMap().get(String(clientId)),preferred=String(c?.billing_profile_id||clientPayload(c).billingProfileIdV59396||'');return (workspace?.billing_profiles||[]).filter(p=>p.is_active!==false).map(p=>`<option value="${esc(p.id)}" ${String(p.id)===preferred?'selected':''}>${esc(p.display_name||p.legal_name||'Billing Profile')}</option>`).join('');}
function itemDatalist(id){return `<datalist id="${id}">${itemLibrary().map(i=>`<option value="${esc(i.item_code||i.accounting_code||i.description)}">${esc(i.description)}${i.accounting_code?` · ${esc(i.accounting_code)}`:''}</option>`).join('')}</datalist>`;}
function lineEditorHtml(lines,kind){const listId=`mp28Items-${kind}`;return `${itemDatalist(listId)}<div class="mp28-line-head"><strong>Items</strong><button type="button" data-add-line>+ Add line</button></div><div data-lines>${lines.map((l,i)=>`<div class="mp28-line" data-line="${i}"><label>Code<input list="${listId}" data-field="itemCode" value="${esc(l.itemCode||'')}" placeholder="Pastel/Sage"></label><label class="description">Description<input data-field="description" value="${esc(l.description||'')}" placeholder="Work or item"></label><label>Qty<input data-field="qty" type="number" min="0.01" step="0.01" value="${num(l.qty)||1}"></label><label>Price<input data-field="unitPrice" type="number" min="0" step="0.01" value="${num(l.unitPrice)}"></label><button type="button" data-remove-line aria-label="Remove">×</button></div>`).join('')}</div><div class="mp28-total"><span>Total</span><strong data-total>${money(lines.reduce((s,l)=>s+num(l.qty)*num(l.unitPrice),0))}</strong></div>`;}
function bindLineEditor(dlg,lines,rerender){const host=dlg.querySelector('[data-lines]');if(!host)return;host.querySelectorAll('[data-line]').forEach(row=>{const idx=num(row.dataset.line);row.querySelectorAll('[data-field]').forEach(input=>{input.oninput=()=>{const f=input.dataset.field;lines[idx][f]=['qty','unitPrice'].includes(f)?num(input.value):input.value;if(f==='itemCode'){const item=itemMatch(input.value);if(item){lines[idx].itemCode=item.item_code||'';lines[idx].accountingCode=item.accounting_code||'';lines[idx].description=item.description||lines[idx].description;lines[idx].unit=item.unit||'';lines[idx].unitPrice=num(item.default_price);rerender();return;}}const total=dlg.querySelector('[data-total]');if(total)total.textContent=money(lines.reduce((s,l)=>s+num(l.qty)*num(l.unitPrice),0));};});row.querySelector('[data-remove-line]').onclick=()=>{if(lines.length===1)lines[0]=newLine();else lines.splice(idx,1);rerender();};});dlg.querySelector('[data-add-line]').onclick=()=>{lines.push(newLine());rerender();};}
function contactPayload(prefix){return {name:$(`${prefix}Name`)?.value.trim()||'',contact_name:$(`${prefix}Contact`)?.value.trim()||'',phone:$(`${prefix}Phone`)?.value.trim()||'',email:$(`${prefix}Email`)?.value.trim()||'',address:$(`${prefix}Address`)?.value.trim()||'',suburb:$(`${prefix}Suburb`)?.value.trim()||''};}
function validLines(lines){return lines.map(l=>({...l,description:String(l.description||'').trim(),qty:num(l.qty),unitPrice:num(l.unitPrice)})).filter(l=>l.description||l.itemCode||l.unitPrice).filter(l=>l.description&&l.qty>0&&l.unitPrice>=0);}

function openQuickQuote(clientId=''){
  quoteLines=[newLine()];let mode=clientId?'existing':'existing';const clients=activeClients().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const dlg=dialog('mp28QuoteDialog',`<form id="mp28QuoteForm"><div class="mp28-dialog-head"><div><span class="mp28-eyebrow">Quick Quote</span><h2>Create quote</h2><p>Existing routine clients stay EXTRA work — never O.</p></div><button type="button" data-close>×</button></div><div class="mp28-mode"><button type="button" data-mode="existing" class="active">Existing client</button><button type="button" data-mode="new">Quick contact</button></div><div data-existing><label>Client<select id="mp28QuoteClient"><option value="">Choose client</option>${clients.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(clientId)?'selected':''}>${esc(c.name)} — ${esc(c.address||'')}</option>`).join('')}</select></label></div><div data-new class="hidden">${contactFields('mp28Quote')}</div><div class="mp28-form-grid"><label>Quote date<input id="mp28QuoteDate" type="date" value="${isoToday()}"></label><label>Validity<input id="mp28QuoteValidity" type="number" min="1" max="365" value="7"></label>${(workspace?.billing_profiles||[]).length>1?`<label>Billing Profile<select id="mp28QuoteProfile">${billingProfilesOptions(clientId)}</select></label>`:''}</div><div id="mp28QuoteLineHost"></div><details class="mp28-more"><summary>More options</summary><label>Payment terms<select id="mp28QuoteTerms"><option value="after-completion">Payment after completion</option><option value="part-payment">Deposit before scheduling</option><option value="full-prepayment">Full payment before scheduling</option></select></label><label>Customer note<textarea id="mp28QuoteNote" rows="3"></textarea></label><label>Internal note<textarea id="mp28QuoteInternal" rows="2"></textarea></label></details><p id="mp28QuoteMsg" class="mp28-msg"></p><div class="mp28-dialog-actions"><button type="button" data-close class="secondary">Cancel</button><button type="submit">Save draft</button></div></form>`);
  const lineHost=$('mp28QuoteLineHost');const renderLines=()=>{lineHost.innerHTML=lineEditorHtml(quoteLines,'quote');bindLineEditor(dlg,quoteLines,renderLines);};
  const setMode=m=>{mode=m;dlg.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));dlg.querySelector('[data-existing]').classList.toggle('hidden',m!=='existing');dlg.querySelector('[data-new]').classList.toggle('hidden',m!=='new');};dlg.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));dlg.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dlg.close());
  dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const msg=$('mp28QuoteMsg'),lines=validLines(quoteLines);if(!lines.length){msg.textContent='Add at least one complete quote line.';return;}const existingId=mode==='existing'?$('mp28QuoteClient').value:'';const contact=mode==='new'?contactPayload('mp28Quote'):{};if(mode==='existing'&&!existingId){msg.textContent='Choose a client.';return;}if(mode==='new'&&!contact.name){msg.textContent='Add the customer or company name.';return;}msg.textContent='Saving…';const {data,error}=await backend().client.rpc('create_mobile_quote_v60428',{p_business_id:backend().businessId,p_client_id:existingId||null,p_contact:contact,p_lines:lines,p_note:$('mp28QuoteNote').value.trim(),p_internal_note:$('mp28QuoteInternal').value.trim(),p_quote_date:$('mp28QuoteDate').value,p_validity_days:num($('mp28QuoteValidity').value)||7,p_payment_terms:$('mp28QuoteTerms').value,p_billing_profile_id:$('mp28QuoteProfile')?.value||''});if(error){msg.textContent=error.message||'Quote could not be saved.';return;}msg.textContent='Draft quote saved.';await loadWorkspace(true);setTimeout(()=>{dlg.close();showTab('quotes');},250);};
  renderLines();setMode(mode);dlg.showModal();
}

function openQuickInvoice(clientId=''){
  if(profile!=='owner_mobile')return;invoiceLines=[newLine()];let mode='existing';const clients=activeClients().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const dlg=dialog('mp28InvoiceDialog',`<form id="mp28InvoiceForm"><div class="mp28-dialog-head"><div><span class="mp28-eyebrow">Quick Invoice</span><h2>Invoice completed work</h2><p>Existing routine clients keep their routine status. This is additional/manual work.</p></div><button type="button" data-close>×</button></div><div class="mp28-mode"><button type="button" data-mode="existing" class="active">Existing client</button><button type="button" data-mode="new">Quick contact</button></div><div data-existing><label>Client<select id="mp28InvoiceClient"><option value="">Choose client</option>${clients.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(clientId)?'selected':''}>${esc(c.name)} — ${esc(c.address||'')}</option>`).join('')}</select></label></div><div data-new class="hidden">${contactFields('mp28Invoice')}</div><div class="mp28-form-grid"><label>Work completed<input id="mp28InvoiceWorkDate" type="date" value="${isoToday()}"></label><label>Invoice date<input id="mp28InvoiceDate" type="date" value="${isoToday()}"></label>${(workspace?.billing_profiles||[]).length>1?`<label>Billing Profile<select id="mp28InvoiceProfile">${billingProfilesOptions(clientId)}</select></label>`:''}</div><div id="mp28InvoiceLineHost"></div><label>Invoice note<textarea id="mp28InvoiceNote" rows="3">Thank you for your business.</textarea></label><p id="mp28InvoiceMsg" class="mp28-msg"></p><div class="mp28-dialog-actions"><button type="button" data-close class="secondary">Cancel</button><button type="submit">Create invoice</button></div></form>`);
  const lineHost=$('mp28InvoiceLineHost');const renderLines=()=>{lineHost.innerHTML=lineEditorHtml(invoiceLines,'invoice');bindLineEditor(dlg,invoiceLines,renderLines);};const setMode=m=>{mode=m;dlg.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));dlg.querySelector('[data-existing]').classList.toggle('hidden',m!=='existing');dlg.querySelector('[data-new]').classList.toggle('hidden',m!=='new');};dlg.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));dlg.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dlg.close());
  dlg.querySelector('form').onsubmit=async e=>{e.preventDefault();const msg=$('mp28InvoiceMsg'),lines=validLines(invoiceLines);if(!lines.length){msg.textContent='Add at least one complete invoice line.';return;}const existingId=mode==='existing'?$('mp28InvoiceClient').value:'';const contact=mode==='new'?contactPayload('mp28Invoice'):{};if(mode==='existing'&&!existingId){msg.textContent='Choose a client.';return;}if(mode==='new'&&!contact.name){msg.textContent='Add the customer or company name.';return;}msg.textContent='Creating invoice…';const {data,error}=await backend().client.rpc('create_mobile_invoice_v60428',{p_business_id:backend().businessId,p_client_id:existingId||null,p_contact:contact,p_lines:lines,p_note:$('mp28InvoiceNote').value.trim(),p_work_date:$('mp28InvoiceWorkDate').value,p_invoice_date:$('mp28InvoiceDate').value,p_billing_profile_id:$('mp28InvoiceProfile')?.value||''});if(error){msg.textContent=error.message||'Invoice could not be created.';return;}msg.textContent='Invoice created and ready for office review/send.';await loadWorkspace(true);setTimeout(()=>{dlg.close();showTab('billing');},250);};renderLines();setMode(mode);dlg.showModal();
}

async function loadWorkspace(manual=false){
  const b=backend();if(!b?.client||!b.businessId)return;setRefreshUI(true);const start=addDays(weekStart(),-14),end=addDays(weekStart(),56);
  try{
    const workspacePromise=b.client.rpc('load_mobile_profile_workspace_v60428',{p_business_id:b.businessId,p_from:start,p_to:end});
    const financePromise=profile==='owner_mobile'?b.client.rpc('load_mobile_owner_finance_v60429',{p_business_id:b.businessId}):Promise.resolve({data:null,error:null});
    const [workspaceResult,financeResult]=await Promise.all([workspacePromise,financePromise]);
    if(workspaceResult.error)throw workspaceResult.error;
    if(financeResult.error)throw financeResult.error;
    const next=workspaceResult.data||{};next.finance=financeResult.data||{};workspace=next;renderChrome();showTab(currentTab|| (profile==='owner_mobile'?'work':'quotes'));
  }catch(error){
    console.error('Owner mobile workspace',error);
    if(!workspace){$('mp28Body').innerHTML=`<div class="mp28-empty error"><strong>Could not open this mobile workspace.</strong><span>${esc(error.message||error)}</span><button id="mp28Retry">Retry</button></div>`;$('mp28Retry').onclick=()=>loadWorkspace(true);}
    else if(manual){const n=document.createElement('div');n.className='mp28-toast';n.textContent=error.message||'Refresh failed';document.body.appendChild(n);setTimeout(()=>n.remove(),3000);}
  }finally{setRefreshUI(false);}
}

function routeFieldWorker(){profile='field_worker';workspace=null;currentTab='';ensureShell().classList.add('hidden');document.querySelector('.mobile-shell')?.classList.remove('mp28-field-hidden');document.body.classList.remove('mobile-profile-resolving-v60428');}
async function resolveProfile(){
  if(document.body.dataset.app!=='mobile')return;const b=backend();if(!b?.client||!b.businessId||!b.user)return;try{const {data,error}=await b.client.rpc('get_my_mobile_profile_v60424',{p_business_id:b.businessId});if(error)throw error;const next=PROFILE_LABELS[String(data)]?String(data):'field_worker';if(next==='field_worker'){if(profile!=='field_worker')routeFieldWorker();return;}const changed=profile!==next;profile=next;document.querySelector('.mobile-shell')?.classList.add('mp28-field-hidden');ensureShell().classList.remove('hidden');document.body.classList.remove('mobile-profile-resolving-v60428');if(changed){currentTab=next==='owner_mobile'?'work':'quotes';workspace=null;renderChrome();}if(!workspace||changed)await loadWorkspace(false);}catch(error){console.warn('Mobile profile resolution failed',error);}}
function init(){setupPairingProfileUI();if(document.body.dataset.app==='mobile'){document.body.classList.add('mobile-profile-resolving-v60428');let ticks=0;const timer=setInterval(async()=>{ticks++;await resolveProfile();if(profile||ticks>80)clearInterval(timer);},150);setInterval(resolveProfile,60000);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.__tuinbooksMobileProfilesV60430={build:BUILD,refresh:()=>loadWorkspace(true),profile:()=>profile};
})();
