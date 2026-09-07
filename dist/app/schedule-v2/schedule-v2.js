/* TuinBooks Schedule V2 — staging authority v60.8.3
   One visible renderer, direct state mutation through the existing TuinBooks runtime API.
   STAGING ONLY until agent QA passes. */
(()=>{
'use strict';
const BUILD='60.8.3-staging-schedule-v2';
const DAY_NAMES=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const FINAL_STATUSES=new Set(['completed','cancelled','deferred','rescheduled','no-charge','access-failed','voided']);
let weekStart='';
let basketOpen=false;
let rearrange=false;
let selected=new Set();
let syncing=false;
let lastError='';
let installed=false;

const runtime=()=>window.__tuinbooksOnboardingRuntimeV60423||null;
const state=()=>runtime()?.getState?.()||null;
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const addDays=(s,n)=>{const d=new Date(`${s}T12:00:00`);d.setDate(d.getDate()+n);return iso(d)};
const startMonday=(s=iso(new Date()))=>{const d=new Date(`${s}T12:00:00`);let w=d.getDay();if(w===0)w=7;d.setDate(d.getDate()-(w-1));return iso(d)};
const dates=()=>Array.from({length:7},(_,i)=>addDays(weekStart,i));
const dayLabel=s=>new Date(`${s}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'});
const id=(p='id')=>runtime()?.uid?.(p)||`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const toast=(m,t='')=>{try{window.toast?.(m,t)}catch{}; if(t==='error')console.error('[Schedule V2]',m);};
function clone(v){return JSON.parse(JSON.stringify(v));}
function byId(rows,key){return (rows||[]).find(x=>String(x?.id||'')===String(key||''))||null;}
function clientFor(job,s=state()){return byId(s?.clients,job?.clientId)||byId(s?.clients,job?.client_id)||{};}
function teamFor(job,s=state()){return byId(s?.teams,job?.teamId)||byId(s?.teams,job?.team_id)||{};}
function clientName(job,s=state()){const c=clientFor(job,s);return c.name||c.clientName||job?.clientName||'Unknown client';}
function teamName(team){return team?.name||team?.teamName||'Team';}
function status(job){return String(job?.status||'scheduled').toLowerCase();}
function movable(job){return job && !FINAL_STATUSES.has(status(job)) && job.date;}
function recurring(job){const s=String(job?.workKind||job?.revenueType||job?.workMarker||'').toLowerCase();return s.includes('recurr')||s==='r'||Boolean(job?.recurrenceKey||job?.rollingWeekStartV58929||job?.sourceOccurrenceKey?.startsWith?.('rolling:'));}
function activeTeams(s=state()){return (s?.teams||[]).filter(t=>String(t?.status||'active').toLowerCase()!=='inactive');}
function jobsFor(teamId,date,s=state()){
  return (s?.schedules||[]).filter(j=>String(j?.teamId||j?.team_id||'')===String(teamId)&&String(j?.date||'')===date&&status(j)!=='unscheduled')
    .sort((a,b)=>Number(a.sort??a.routeOrder??999)-Number(b.sort??b.routeOrder??999));
}
function manualBasket(s=state()){return Array.isArray(s?.scheduleBasket)?s.scheduleBasket:[];}
function storedUnscheduled(s=state()){return (s?.schedules||[]).filter(j=>!j?.date||status(j)==='unscheduled');}
function basketRows(s=state()){
  const out=[];
  for(const item of manualBasket(s)) out.push({type:'basket',key:String(item.id),item,client:byId(s.clients,item.clientId)||{},name:(byId(s.clients,item.clientId)||{}).name||item.jobPayload?.clientName||'Unknown client'});
  for(const job of storedUnscheduled(s)) out.push({type:'unscheduled',key:String(job.id),job,client:clientFor(job,s),name:clientName(job,s)});
  const seen=new Set();
  return out.filter(r=>{const k=`${r.type}:${r.key}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function root(){return document.getElementById('tbScheduleV2Root');}
function ensureRoot(){
  const view=document.getElementById('view-schedule');if(!view)return null;
  let r=root();if(!r){r=document.createElement('div');r.id='tbScheduleV2Root';view.prepend(r);}
  document.body.classList.add('tb-schedule-v2-staging');
  document.documentElement.dataset.scheduleRenderer='schedule-v2-60.8.3-staging';
  return r;
}
function snapshot(){return clone(state());}
async function persist(before,label){
  const rt=runtime();if(!rt)throw new Error('TuinBooks runtime bridge is unavailable');
  syncing=true;renderStatus();
  try{
    rt.save?.();
    const result=await rt.syncBusinessWorkbookOperationalV6054?.();
    if(result===false)throw new Error('Operational cloud save returned false');
    lastError='';toast(label||'Schedule saved.');return true;
  }catch(error){
    lastError=String(error?.message||error);
    console.error('[Schedule V2] save failed; restoring snapshot',error);
    try{rt.replaceState?.(before);rt.save?.();}catch(restoreError){console.error('[Schedule V2] restore failed',restoreError);}
    toast('The schedule change could not be saved. The previous schedule was restored.','error');
    return false;
  }finally{syncing=false;render();}
}
function dayNameFull(date){const i=dates().indexOf(date);return i>=0?DAY_NAMES[i]:new Date(`${date}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'long'});}
function jobBadge(job){if(status(job)==='completed')return 'Done';if(status(job)==='cancelled')return 'Cancelled';if(recurring(job))return 'R';return '1x';}
function jobClass(job){const s=status(job);return s==='completed'?' completed':s==='cancelled'?' cancelled':(new Date(`${job.date}T23:59:59`)<new Date()&&!FINAL_STATUSES.has(s))?' missed':'';}
function jobHtml(job){const c=clientFor(job);const t=teamFor(job);const checked=selected.has(String(job.id))?' checked':'';return `<article class="tb-sv2-job${jobClass(job)}${selected.has(String(job.id))?' selected':''}" data-job-id="${esc(job.id)}" draggable="${rearrange&&movable(job)?'true':'false'}"><strong title="${esc(clientName(job))}">${esc(clientName(job))}</strong><span class="badge">${esc(jobBadge(job))}</span>${rearrange&&movable(job)?`<input class="tb-sv2-select" type="checkbox" aria-label="Select ${esc(clientName(job))}"${checked}>`:''}<small>${esc(c.suburb||c.address||t.name||'')}</small></article>`;}
function basketCardHtml(row){const hours=Number(row.item?.estimatedHours||row.job?.estimatedHours||row.client?.estimatedHours||0);return `<div class="tb-sv2-basket-card" draggable="true" data-basket-type="${row.type}" data-basket-key="${esc(row.key)}"><span class="mark"></span><strong title="${esc(row.name)}">${esc(row.name)}</strong><small>${hours?`${hours}h`:row.type==='unscheduled'?'unscheduled':'basket'}</small></div>`;}
function boardHtml(s){
  const ds=dates(),teams=activeTeams(s);let html='<div class="tb-sv2-board"><div class="tb-sv2-corner">TEAM / DAY</div>';
  for(const d of ds)html+=`<div class="tb-sv2-dayhead"><strong>${esc(dayLabel(d))}</strong><small>${jobsFor('',d,s).length||''}</small></div>`;
  for(const team of teams){
    const weekCount=ds.reduce((n,d)=>n+jobsFor(team.id,d,s).length,0);
    html+=`<div class="tb-sv2-team" title="${esc(teamName(team))}">${esc(teamName(team))}<small>${weekCount} visit${weekCount===1?'':'s'}</small></div>`;
    for(const d of ds){const jobs=jobsFor(team.id,d,s);html+=`<div class="tb-sv2-lane" data-team-id="${esc(team.id)}" data-date="${d}">${jobs.map(jobHtml).join('')}</div>`;}
  }
  if(!teams.length)html+='<div class="tb-sv2-error" style="grid-column:1/-1">No active teams were found in this workspace.</div>';
  return html+'</div>';
}
function renderStatus(){const el=document.querySelector('#tbScheduleV2Root .tb-sv2-status');if(el)el.textContent=syncing?'Saving…':lastError?'Save error':'Saved';}
function render(){
  const r=ensureRoot();if(!r)return;
  const s=state();if(!s){r.innerHTML='<div class="tb-sv2-error">Waiting for TuinBooks workspace data…</div>';setTimeout(render,500);return;}
  if(!weekStart)weekStart=startMonday(runtime()?.getScheduleWeekStart?.()||iso(new Date()));
  r.className=`${rearrange?'rearrange ':''}${basketOpen?'basket-open ':''}`.trim();
  const br=basketRows(s);
  r.innerHTML=`<div class="tb-sv2-shell"><div class="tb-sv2-top"><button data-act="prev">‹ Previous</button><button data-act="today">Today</button><button data-act="next">Next ›</button><span class="tb-sv2-week">${esc(dayLabel(weekStart))} – ${esc(dayLabel(addDays(weekStart,6)))}</span><div class="tb-sv2-spacer"></div><button data-act="basket" class="${basketOpen?'active':''}">Basket (${br.length})</button><button data-act="rearrange" class="primary ${rearrange?'active':''}">${rearrange?'Exit rearrange':'Rearrange schedule'}</button><span class="tb-sv2-status">${syncing?'Saving…':lastError?'Save error':'Saved'}</span></div><div class="tb-sv2-selectedbar"><strong>${selected.size} selected</strong><button data-act="selected-basket">Move selected to Basket</button><button data-act="clear-select">Clear</button></div><div class="tb-sv2-layout"><aside class="tb-sv2-basket" data-basket-drop="1"><div class="tb-sv2-basket-head"><strong>Basket</strong><span class="tb-sv2-count">${br.length} item${br.length===1?'':'s'}</span></div><div class="tb-sv2-basket-list">${br.map(basketCardHtml).join('')||'<div class="tb-sv2-basket-empty">Basket is empty.</div>'}</div></aside><main class="tb-sv2-board-wrap">${boardHtml(s)}</main></div></div>`;
  bind(r);
}
function dragData(ev){try{return JSON.parse(ev.dataTransfer.getData('application/json')||ev.dataTransfer.getData('text/plain')||'null')}catch{return null}}
function bind(r){
  r.querySelector('[data-act="prev"]')?.addEventListener('click',()=>{weekStart=addDays(weekStart,-7);selected.clear();render();});
  r.querySelector('[data-act="today"]')?.addEventListener('click',()=>{weekStart=startMonday();selected.clear();render();});
  r.querySelector('[data-act="next"]')?.addEventListener('click',()=>{weekStart=addDays(weekStart,7);selected.clear();render();});
  r.querySelector('[data-act="basket"]')?.addEventListener('click',()=>{basketOpen=!basketOpen;render();});
  r.querySelector('[data-act="rearrange"]')?.addEventListener('click',()=>{rearrange=!rearrange;if(rearrange)basketOpen=true;else selected.clear();render();});
  r.querySelector('[data-act="clear-select"]')?.addEventListener('click',()=>{selected.clear();render();});
  r.querySelector('[data-act="selected-basket"]')?.addEventListener('click',moveSelectedToBasket);
  r.querySelectorAll('.tb-sv2-select').forEach(cb=>cb.addEventListener('click',ev=>{ev.stopPropagation();const jobId=cb.closest('[data-job-id]')?.dataset.jobId;if(!jobId)return;cb.checked?selected.add(jobId):selected.delete(jobId);render();}));
  r.querySelectorAll('.tb-sv2-job[draggable="true"]').forEach(card=>card.addEventListener('dragstart',ev=>{const payload={type:'job',id:card.dataset.jobId};ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('application/json',JSON.stringify(payload));ev.dataTransfer.setData('text/plain',JSON.stringify(payload));}));
  r.querySelectorAll('.tb-sv2-basket-card').forEach(card=>card.addEventListener('dragstart',ev=>{const payload={type:card.dataset.basketType,key:card.dataset.basketKey};ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('application/json',JSON.stringify(payload));ev.dataTransfer.setData('text/plain',JSON.stringify(payload));}));
  r.querySelectorAll('.tb-sv2-lane').forEach(lane=>{
    lane.addEventListener('dragover',ev=>{if(!rearrange)return;ev.preventDefault();lane.classList.add('drag-over');});
    lane.addEventListener('dragleave',()=>lane.classList.remove('drag-over'));
    lane.addEventListener('drop',async ev=>{ev.preventDefault();lane.classList.remove('drag-over');if(!rearrange)return;const p=dragData(ev);if(!p)return;await dropToLane(p,lane.dataset.teamId,lane.dataset.date);});
  });
  const basket=r.querySelector('[data-basket-drop]');
  basket?.addEventListener('dragover',ev=>{if(!rearrange)return;const p=dragData(ev);if(p?.type==='job')ev.preventDefault();});
  basket?.addEventListener('drop',async ev=>{ev.preventDefault();if(!rearrange)return;const p=dragData(ev);if(p?.type==='job')await moveJobsToBasket([p.id]);});
}
function askScope(job,targetDate,targetTeam){
  if(!recurring(job))return Promise.resolve('one');
  return new Promise(resolve=>{
    const r=root();const dlg=document.createElement('dialog');dlg.className='tb-sv2-dialog';dlg.innerHTML=`<div class="tb-sv2-dialog-inner"><h3>Move recurring visit</h3><p>${esc(clientName(job))} is recurring. How much of the schedule should move to ${esc(dayNameFull(targetDate))}?</p><div class="tb-sv2-dialog-actions"><button data-v="cancel">Cancel</button><button data-v="future">This & future visits</button><button class="primary" data-v="one">This visit only</button></div></div>`;r.appendChild(dlg);dlg.querySelectorAll('button').forEach(b=>b.onclick=()=>{const v=b.dataset.v;dlg.close();dlg.remove();resolve(v)});dlg.addEventListener('cancel',ev=>{ev.preventDefault();dlg.remove();resolve('cancel')});dlg.showModal();
  });
}
async function dropToLane(p,teamId,date){
  const s=state();if(!s)return;
  if(p.type==='job'){
    const job=byId(s.schedules,p.id);if(!movable(job))return toast('That appointment cannot be moved.','error');
    const scope=await askScope(job,date,teamId);if(scope==='cancel')return;
    if(scope==='future')return moveRecurringFuture(job,teamId,date);
    return moveOneJob(job,teamId,date);
  }
  if(p.type==='basket')return placeBasketItem(p.key,teamId,date);
  if(p.type==='unscheduled')return placeStoredUnscheduled(p.key,teamId,date);
}
async function moveOneJob(job,teamId,date){const before=snapshot();job.date=date;job.teamId=teamId;job.team_id=teamId;job.status='scheduled';job.manualOverride=true;job.autoGenerated=false;job.autoAssigned=false;job.sort=999;job.updatedAt=new Date().toISOString();return persist(before,`${clientName(job)} moved.`);}
async function moveRecurringFuture(job,teamId,date){
  const s=state();const before=snapshot();const sourceDate=job.date;const delta=Math.round((new Date(`${date}T12:00:00`)-new Date(`${sourceDate}T12:00:00`))/86400000);const clientId=job.clientId||job.client_id;
  const rows=(s.schedules||[]).filter(row=>(row.clientId||row.client_id)===clientId&&String(row.date||'')>=String(sourceDate)&&recurring(row)&&!FINAL_STATUSES.has(status(row)));
  if(!rows.length)return toast('No future recurring visits were found.','error');
  for(const row of rows){row.date=addDays(row.date,delta);row.teamId=teamId;row.team_id=teamId;row.manualOverride=true;row.autoAssigned=false;row.updatedAt=new Date().toISOString();}
  const c=byId(s.clients,clientId);if(c){c.preferredDay=dayNameFull(date);c.teamId=teamId;c.preferredTeamId=teamId;c.recurrenceAnchorDate=date;c.updatedAt=new Date().toISOString();}
  return persist(before,`${clientName(job)} and future visits moved.`);
}
function makeBasketItem(job,s){const c=clientFor(job,s),now=new Date().toISOString();return {id:id('basket'),sourceJobId:job.id,clientId:job.clientId||job.client_id,originalDate:job.date||'',originalTeamId:job.teamId||job.team_id||'',weekStart:startMonday(job.date||iso(new Date())),estimatedHours:Math.max(.25,Number(job.estimatedHours||c.estimatedHours||1)),serviceIds:[...(job.serviceIds||[])],workTypeIds:[...(job.workTypeIds||c.workTypeIds||[])],clusterId:job.clusterId||c.clusterId||'',quoteId:job.quoteId||'',workKind:job.workKind||'',revenueType:job.revenueType||'',workMarker:job.workMarker||'',reason:'Moved to Basket by office',jobPayload:clone(job),createdAt:now,updatedAt:now};}
async function moveJobsToBasket(ids){
  const s=state(),before=snapshot();s.scheduleBasket=Array.isArray(s.scheduleBasket)?s.scheduleBasket:[];let count=0;
  for(const key of ids){const job=byId(s.schedules,key);if(!movable(job))continue;if(!s.scheduleBasket.some(x=>String(x.sourceJobId)===String(job.id)))s.scheduleBasket.push(makeBasketItem(job,s));
    for(const cm of (s.serviceCommitments||[])){if(String(cm.scheduleJobId||'')===String(job.id)){cm.scheduleJobId='';cm.status='Unscheduled';cm.updatedAt=new Date().toISOString();}}
    if(job.quoteId){const q=byId(s.quotes,job.quoteId);if(q){q.scheduled=false;delete q.scheduledDate;delete q.scheduledTeamId;delete q.scheduledJobId;}}
    s.schedules=s.schedules.filter(x=>String(x.id)!==String(job.id));selected.delete(String(job.id));count++;
  }
  if(!count)return toast('No movable appointments were selected.','error');
  return persist(before,`${count} appointment${count===1?'':'s'} moved to Basket.`);
}
async function moveSelectedToBasket(){return moveJobsToBasket([...selected]);}
async function placeBasketItem(key,teamId,date){
  const s=state(),item=byId(s.scheduleBasket,key);if(!item)return toast('That Basket item is no longer available.','error');const before=snapshot();const source=clone(item.jobPayload||{});const c=byId(s.clients,item.clientId)||{};
  const job={...source,id:item.sourceJobId||source.id||id('sch'),clientId:item.clientId||source.clientId,date,teamId,team_id:teamId,status:'scheduled',sort:999,manualOverride:true,autoGenerated:false,autoAssigned:false,estimatedHours:Math.max(.25,Number(item.estimatedHours||source.estimatedHours||c.estimatedHours||1)),serviceIds:[...(item.serviceIds||source.serviceIds||[])],workTypeIds:[...(item.workTypeIds||source.workTypeIds||[])]};
  delete job.completedAt;delete job.completedByTeamId;delete job.resolution;delete job.resolvedAtV58931;
  s.schedules=(s.schedules||[]).filter(x=>String(x.id)!==String(job.id));s.schedules.push(job);s.scheduleBasket=s.scheduleBasket.filter(x=>String(x.id)!==String(key));
  for(const cm of (s.serviceCommitments||[])){if((job.commitmentIds||[]).includes(cm.id)){cm.scheduleJobId=job.id;cm.status='Scheduled';cm.updatedAt=new Date().toISOString();}}
  if(job.quoteId){const q=byId(s.quotes,job.quoteId);if(q){q.scheduled=true;q.scheduledAt=new Date().toISOString();q.scheduledDate=date;q.scheduledTeamId=teamId;q.scheduledJobId=job.id;}}
  return persist(before,`${clientName(job,s)} placed from Basket.`);
}
async function placeStoredUnscheduled(key,teamId,date){const s=state(),job=byId(s.schedules,key);if(!job)return toast('That unscheduled item is no longer available.','error');const before=snapshot();job.date=date;job.teamId=teamId;job.team_id=teamId;job.status='scheduled';job.manualOverride=true;job.autoGenerated=false;job.sort=999;job.updatedAt=new Date().toISOString();return persist(before,`${clientName(job,s)} scheduled.`);}
function install(){
  if(installed)return;installed=true;window.__TUINBOOKS_STAGING_RELEASE__=BUILD;
  const old=window.renderSchedule;
  try{window.renderSchedule=render;}catch(error){console.warn('[Schedule V2] could not replace window.renderSchedule',error);}
  window.__tuinbooksScheduleV2={build:BUILD,render,getState:state,moveOneJob,moveRecurringFuture,moveJobsToBasket,placeBasketItem};
  const boot=()=>{ensureRoot();render();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('click',ev=>{if(ev.target?.closest?.('[data-view="schedule"]'))setTimeout(render,0)},true);
  window.addEventListener('pageshow',()=>setTimeout(render,0));
  console.info(`[TuinBooks ${BUILD}] installed`,{previousRenderer:typeof old});
}
install();
})();
