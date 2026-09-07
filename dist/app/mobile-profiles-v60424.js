(() => {
'use strict';
const BUILD='60.4.25-mobile-access-profiles-no-scheduler';
const PROFILE_LABELS={field_worker:'Field Worker',owner_mobile:'Owner Mobile',estimator:'Estimator'};
let appliedProfile='';
let workspace=null;
let weekOffset=0;
let quoteLines=[{description:'',qty:1,unitPrice:0}];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`R ${Number(n||0).toLocaleString('en-ZA',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
const localISO=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return localISO(d);};
const weekStart=()=>{const d=new Date();let day=d.getDay()||7;d.setDate(d.getDate()-(day-1)+(weekOffset*7));return localISO(d);};
const fmtDate=iso=>iso?new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'}):'—';
const backend=()=>window.backendV28;

function setupPairingProfileUI(){
  const select=$('mobilePairingProfileV60424'),teamWrap=$('mobilePairingTeamWrapV60424'),team=$('mobilePairingTeam'),help=$('mobilePairingProfileHelpV60424');
  if(!select||select.dataset.boundV60424)return;
  select.dataset.boundV60424='1';
  const apply=()=>{
    const p=select.value;
    const field=p==='field_worker';
    if(teamWrap)teamWrap.classList.toggle('mobile-profile-team-hidden-v60424',!field);
    if(team)team.required=true; // legacy pairing RPC still needs an internal team anchor.
    if(help)help.textContent=p==='field_worker'?'Assigned route only. Can complete jobs, add photos and report opportunities.':p==='owner_mobile'?'All teams. Schedule and Work are view-only; Quotes, Invoices and Clients are visible.':'Quotes only. Can select an existing client and create draft quotes.';
  };
  select.addEventListener('change',apply);apply();
}

function profileShell(){
  let shell=$('mobileProfileShellV60424');
  if(shell)return shell;
  shell=document.createElement('div');shell.id='mobileProfileShellV60424';shell.className='mobile-profile-shell-v60424 hidden';
  shell.innerHTML=`<header class="mobile-profile-header-v60424"><div><span id="mobileProfileEyebrowV60424">Mobile profile</span><strong id="mobileProfileBusinessV60424">TuinBooks</strong><small id="mobileProfileNameV60424"></small></div><button type="button" id="mobileProfileRefreshV60424">Refresh</button></header><nav id="mobileProfileNavV60424" class="mobile-profile-nav-v60424"></nav><main id="mobileProfileBodyV60424" class="mobile-profile-body-v60424"></main>`;
  const gate=document.querySelector('.backend-gate');
  if(gate)gate.after(shell);else document.body.prepend(shell);
  $('mobileProfileRefreshV60424').onclick=()=>loadProfileWorkspace(true);
  return shell;
}

function clientMap(){return new Map((workspace?.clients||[]).map(c=>[String(c.id),c]));}
function teamMap(){return new Map((workspace?.teams||[]).map(t=>[String(t.id),t]));}
function lineItems(q){return Array.isArray(q?.payload?.lineItems)?q.payload.lineItems:Array.isArray(q?.lineItems)?q.lineItems:[];}
function quoteTotal(q){return lineItems(q).reduce((s,l)=>s+Number(l.qty||0)*Number(l.unitPrice||0),0);}

function navItems(profile){
  if(profile==='owner_mobile')return [['schedule','Schedule'],['work','Work'],['quotes','Quotes'],['invoices','Invoices'],['clients','Clients']];
  if(profile==='estimator')return [['quotes','Quotes']];
  return [];
}

function showTab(tab){
  document.querySelectorAll('#mobileProfileNavV60424 button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='schedule')renderSchedule();
  else if(tab==='work')renderWork();
  else if(tab==='quotes')renderQuotes();
  else if(tab==='invoices')renderInvoices();
  else if(tab==='clients')renderClients();
}

function renderProfileChrome(profile){
  const shell=profileShell();
  shell.classList.remove('hidden');
  document.querySelector('.mobile-shell')?.classList.add('mobile-profile-base-hidden-v60424');
  $('mobileProfileBusinessV60424').textContent=workspace?.business?.name||window.state?.business?.name||'TuinBooks';
  $('mobileProfileNameV60424').textContent=PROFILE_LABELS[profile]||profile;
  const nav=$('mobileProfileNavV60424');
  const items=navItems(profile);nav.innerHTML=items.map(([id,label],i)=>`<button type="button" data-tab="${id}" class="${i===0?'active':''}">${label}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  showTab(items[0]?.[0]||'schedule');
}

function renderSchedule(){
  const body=$('mobileProfileBodyV60424'),cm=clientMap(),tm=teamMap(),start=weekStart(),end=addDays(start,5);
  const rows=(workspace?.schedules||[]).filter(j=>j.visit_date>=start&&j.visit_date<=end);
  const dates=Array.from({length:6},(_,i)=>addDays(start,i));
  body.innerHTML=`<section class="mobile-profile-toolbar-v60424"><button id="mpPrevWeek">←</button><strong>${fmtDate(start)} – ${fmtDate(end)}</strong><button id="mpNextWeek">→</button></section>${dates.map(date=>{const dayRows=rows.filter(r=>r.visit_date===date);return `<section class="mobile-profile-card-v60424"><h2>${fmtDate(date)} <span>${dayRows.length} jobs</span></h2>${dayRows.length?Array.from(new Set(dayRows.map(r=>String(r.team_id)))).map(teamId=>{const team=tm.get(teamId)||{};const jobs=dayRows.filter(r=>String(r.team_id)===teamId).sort((a,b)=>Number(a.sort_order||99)-Number(b.sort_order||99));return `<div class="mobile-profile-team-v60424"><h3>${esc(team.name||'Team')}</h3>${jobs.map(j=>{const c=cm.get(String(j.client_id))||{};return `<article><b>${esc(c.name||'Client')}</b><span>${esc(c.address||'')}</span><small>${esc(j.status||'scheduled')}</small></article>`;}).join('')}</div>`;}).join(''):'<p class="mobile-profile-empty-v60424">Open day</p>'}</section>`;}).join('')}`;
  $('mpPrevWeek').onclick=()=>{weekOffset--;renderSchedule();};$('mpNextWeek').onclick=()=>{weekOffset++;renderSchedule();};
}

function renderWork(){
  const body=$('mobileProfileBodyV60424'),cm=clientMap(),tm=teamMap();
  const rows=(workspace?.work||[]).slice().sort((a,b)=>String(b.work_date||'').localeCompare(String(a.work_date||''))).slice(0,80);
  body.innerHTML=`<section class="mobile-profile-title-v60424"><h1>Recent work</h1><p>Read-only view across the permitted teams.</p></section>${rows.map(r=>{const c=cm.get(String(r.client_id))||{},t=tm.get(String(r.team_id))||{},p=r.payload||{};return `<article class="mobile-profile-list-row-v60424"><div><strong>${esc(c.name||p.clientName||'Client')}</strong><span>${esc(c.address||'')}</span><small>${fmtDate(r.work_date)} · ${esc(t.name||'Team')} · ${esc(r.outcome||'Completed')}</small></div></article>`;}).join('')||'<p class="mobile-profile-empty-v60424">No work records in this period.</p>'}`;
}

function quoteComposer(){
  const clients=(workspace?.clients||[]).filter(c=>String(c.status||'active').toLowerCase()!=='archived');
  return `<section class="mobile-profile-card-v60424 mobile-quote-compose-v60424"><h2>New draft quote</h2><form id="mobileQuoteFormV60424"><label>Client<select id="mobileQuoteClientV60424">${clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} — ${esc(c.address||'')}</option>`).join('')}</select></label><div id="mobileQuoteLinesV60424"></div><button type="button" class="mobile-profile-secondary-v60424" id="mobileQuoteAddLineV60424">+ Add item</button><label>Internal note<textarea id="mobileQuoteNoteV60424" rows="3"></textarea></label><button type="submit" class="mobile-profile-primary-v60424">Save draft quote</button><p id="mobileQuoteMessageV60424"></p></form></section>`;
}
function renderQuoteLines(){
  const host=$('mobileQuoteLinesV60424');if(!host)return;
  host.innerHTML=quoteLines.map((l,i)=>`<div class="mobile-quote-line-v60424"><input data-q-desc="${i}" placeholder="Description" value="${esc(l.description)}"><input data-q-qty="${i}" type="number" min="0.01" step="0.01" value="${Number(l.qty||1)}" aria-label="Quantity"><input data-q-price="${i}" type="number" min="0" step="0.01" value="${Number(l.unitPrice||0)}" aria-label="Price"><button type="button" data-q-remove="${i}">×</button></div>`).join('');
  host.querySelectorAll('[data-q-desc]').forEach(el=>el.oninput=()=>quoteLines[Number(el.dataset.qDesc)].description=el.value);
  host.querySelectorAll('[data-q-qty]').forEach(el=>el.oninput=()=>quoteLines[Number(el.dataset.qQty)].qty=Number(el.value||0));
  host.querySelectorAll('[data-q-price]').forEach(el=>el.oninput=()=>quoteLines[Number(el.dataset.qPrice)].unitPrice=Number(el.value||0));
  host.querySelectorAll('[data-q-remove]').forEach(el=>el.onclick=()=>{if(quoteLines.length>1){quoteLines.splice(Number(el.dataset.qRemove),1);renderQuoteLines();}});
}
async function submitQuote(ev){
  ev.preventDefault();const msg=$('mobileQuoteMessageV60424');
  const lines=quoteLines.filter(l=>String(l.description||'').trim()&&Number(l.qty)>0&&Number(l.unitPrice)>=0).map(l=>({description:String(l.description).trim(),qty:Number(l.qty),unitPrice:Number(l.unitPrice)}));
  if(!lines.length){msg.textContent='Add at least one quoted item.';return;}
  msg.textContent='Saving…';
  const {data,error}=await backend().client.rpc('create_mobile_quote_v60424',{p_business_id:backend().businessId,p_client_id:$('mobileQuoteClientV60424').value,p_lines:lines,p_note:$('mobileQuoteNoteV60424').value.trim()});
  if(error){msg.textContent=error.message||'Quote could not be saved.';return;}
  quoteLines=[{description:'',qty:1,unitPrice:0}];msg.textContent='Draft quote saved.';await loadProfileWorkspace(true);showTab('quotes');
}
function renderQuotes(){
  const body=$('mobileProfileBodyV60424'),cm=clientMap(),profile=appliedProfile;
  const rows=(workspace?.quotes||[]).slice().sort((a,b)=>String(b.quote_date||'').localeCompare(String(a.quote_date||''))).slice(0,80);
  body.innerHTML=`<section class="mobile-profile-title-v60424"><h1>Quotes</h1><p>${profile==='estimator'?'This profile can create quotes only.':'Recent quotes for the business.'}</p></section>${(profile==='estimator'||profile==='owner_mobile')?quoteComposer():''}<section class="mobile-profile-card-v60424"><h2>Recent quotes</h2>${rows.map(q=>{const c=cm.get(String(q.client_id))||{},p=q.payload||{};return `<article class="mobile-profile-list-row-v60424"><div><strong>${esc(c.name||'Client')}</strong><span>${esc(p.number||p.quoteNumber||'Draft quote')} · ${esc(q.status||'Draft')}</span><small>${fmtDate(q.quote_date)} · ${money(quoteTotal(q))}</small></div></article>`;}).join('')||'<p class="mobile-profile-empty-v60424">No quotes yet.</p>'}</section>`;
  if(profile==='estimator'||profile==='owner_mobile'){
    renderQuoteLines();$('mobileQuoteAddLineV60424').onclick=()=>{quoteLines.push({description:'',qty:1,unitPrice:0});renderQuoteLines();};$('mobileQuoteFormV60424').onsubmit=submitQuote;
  }
}
function renderInvoices(){
  const body=$('mobileProfileBodyV60424'),cm=clientMap();
  const rows=(workspace?.invoices||[]).slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,80);
  body.innerHTML=`<section class="mobile-profile-title-v60424"><h1>Invoices</h1><p>Mobile owner view. Financial changes remain in the office workspace.</p></section>${rows.map(inv=>{const c=cm.get(String(inv.client_id))||{};return `<article class="mobile-profile-list-row-v60424"><div><strong>${esc(c.name||'Client')}</strong><span>${esc(inv.invoice_number||'Draft')} · ${esc(inv.status||'Draft')}</span><small>${money(inv.total||0)}</small></div></article>`;}).join('')||'<p class="mobile-profile-empty-v60424">No invoices yet.</p>'}`;
}
function renderClients(){
  const body=$('mobileProfileBodyV60424');
  body.innerHTML=`<section class="mobile-profile-title-v60424"><h1>Clients</h1><input id="mobileClientFilterV60424" class="mobile-profile-search-v60424" placeholder="Search client or address"></section><div id="mobileClientRowsV60424"></div>`;
  const draw=()=>{const q=String($('mobileClientFilterV60424').value||'').toLowerCase();const rows=(workspace?.clients||[]).filter(c=>!q||`${c.name} ${c.address} ${c.suburb} ${c.contact_name} ${c.phone}`.toLowerCase().includes(q)).slice(0,120);$('mobileClientRowsV60424').innerHTML=rows.map(c=>`<article class="mobile-profile-list-row-v60424"><div><strong>${esc(c.name||'Client')}</strong><span>${esc(c.address||'')}${c.suburb?` · ${esc(c.suburb)}`:''}</span><small>${esc(c.contact_name||'')}${c.phone?` · ${esc(c.phone)}`:''}</small></div></article>`).join('')||'<p class="mobile-profile-empty-v60424">No matching clients.</p>';};$('mobileClientFilterV60424').oninput=draw;draw();
}

async function loadProfileWorkspace(manual=false){
  const b=backend();if(!b?.client||!b.businessId)return;
  const start=addDays(weekStart(),-7),end=addDays(weekStart(),41);
  const {data,error}=await b.client.rpc('load_mobile_profile_workspace_v60424',{p_business_id:b.businessId,p_from:start,p_to:end});
  if(error){if(manual)alert(error.message||'Could not refresh mobile workspace.');return;}
  workspace=data||{};renderProfileChrome(appliedProfile);
}

async function applyCurrentProfile(){
  if(document.body.dataset.app!=='mobile')return;
  const b=backend();if(!b?.client||!b.businessId||!b.user)return;
  try{
    const {data,error}=await b.client.rpc('get_my_mobile_profile_v60424',{p_business_id:b.businessId});
    if(error)throw error;
    const profile=String(data||'field_worker');b.mobileProfileV60424=profile;
    if(profile==='field_worker'){
      appliedProfile=profile;profileShell().classList.add('hidden');document.querySelector('.mobile-shell')?.classList.remove('mobile-profile-base-hidden-v60424');return;
    }
    appliedProfile=profile;await loadProfileWorkspace(false);
  }catch(error){
    console.warn('Mobile profile unavailable',error);
  }
}

function init(){setupPairingProfileUI();if(document.body.dataset.app==='mobile'){setInterval(()=>applyCurrentProfile(),60000);let ticks=0;const timer=setInterval(()=>{ticks++;applyCurrentProfile();if(appliedProfile||ticks>40)clearInterval(timer);},350);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.__tuinbooksMobileProfilesV60424=BUILD;
})();
