/* TuinBooks v60.8.6 — clean Schedule engine candidate
   One owner for Schedule rendering, Basket, Rearrange mode and Schedule moves.
   Uses the existing TuinBooks state/persistence core; does not call legacy Schedule renderers.
*/
(()=>{
'use strict';
const BUILD='60.8.6-clean-schedule-engine';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TERMINAL=new Set(['completed','cancelled','canceled','deferred','rescheduled','no-charge','access-failed']);
const STORAGE_SCOPE='tuinbooks.scheduleDragScope.v6086';
let dragMode=false;
let dragScope='once';
let basketOpen=false;
let basketMinimised=false;
let basketSearch='';
let activeDrag=null;
let actions=[];
let actionsLoadedAt=0;
let actionsBusiness='';
let actionPromise=null;
let rendering=false;
let lastRenderSignature='';

try{const v=localStorage.getItem(STORAGE_SCOPE)||localStorage.getItem('tuinbooks.scheduleDragScope.v6061');if(v==='future'||v==='once')dragScope=v;}catch(_){ }
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const core=()=>window.__tuinbooksScheduleCoreV6086||window.__tuinbooksOnboardingRuntimeV60423||null;
const state=()=>core()?.getState?.()||window.state||{};
const backend=()=>core()?.getBackend?.()||null;
const today=()=>core()?.localDateISO?.()||new Date().toISOString().slice(0,10);
const addDays=(iso,n)=>core()?.dateAdd?.(iso,n)||(()=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);})();
const startWeek=(iso=today())=>core()?.startOfWeek?.(iso)||(()=>{const d=new Date(`${iso}T12:00:00`);let day=d.getDay();if(day===0)day=7;d.setDate(d.getDate()-(day-1));return d.toISOString().slice(0,10);})();
const fmtShort=(iso)=>core()?.fmtShortDate?.(iso)||new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
const weekDates=(week)=>DAYS.map((_,i)=>addDays(week,i));
const dayName=iso=>DAYS[new Date(`${iso}T12:00:00`).getDay()-1]||'Sunday';
const uid=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const toast=(m,t='')=>{try{window.toast?.(m,t);}catch(_){ }};
const clientById=id=>(state().clients||[]).find(x=>String(x.id)===String(id))||null;
const teamById=id=>(state().teams||[]).find(x=>String(x.id)===String(id))||null;
const quoteById=id=>(state().quotes||[]).find(x=>String(x.id)===String(id))||null;
const activeTeams=()=> (state().teams||[]).filter(t=>t&&t.active!==false);
const isPast=date=>String(date||'')<today();
const markerForJob=job=>{const type=String(job?.workKind||job?.revenueType||'').toLowerCase();return job?.quoteId||job?.sourceQuoteId||type.includes('once')||type.includes('quote')||type.includes('project')||type.includes('additional')?'O':'R';};
const clientName=c=>String(c?.name||c?.address||'Unknown site').trim();
const clientArea=c=>String(c?.suburb||c?.routeArea||c?.serviceArea||c?.siteGroupName||c?.address||'Area not set').trim();
const teamColour=t=>String(t?.visualColor||t?.color||'#2E8B68');
const routeOrder=j=>Number.isFinite(Number(j?.sort))?Number(j.sort):Number(j?.routeOrder||9999);
const durationHours=(job,client)=>Math.max(.25,Number(job?.estimatedHours||client?.estimatedHours||1));
const durationLabel=h=>{const mins=Math.max(0,Math.round(Number(h||0)*60)),hr=Math.floor(mins/60),m=mins%60;return hr&&m?`${hr}h ${m}m`:hr?`${hr}h`:`${m}m`;};

function weekValue(){const picker=$('scheduleWeekPicker');const value=picker?.value||startWeek(today());return startWeek(value);}
function setWeek(value){const picker=$('scheduleWeekPicker');if(picker)picker.value=startWeek(value);render();}
function currentWeek(){return startWeek(today());}
function weekJobs(dates){const set=new Set(dates);return (state().schedules||[]).filter(j=>set.has(String(j.date||'').slice(0,10))&&String(j.status||'').toLowerCase()!=='cancelled');}
function jobsFor(teamId,date){return (state().schedules||[]).filter(j=>String(j.teamId)===String(teamId)&&String(j.date||'').slice(0,10)===String(date)&&String(j.status||'').toLowerCase()!=='cancelled').sort((a,b)=>routeOrder(a)-routeOrder(b));}
function capacityHours(team,date){const plans=state().teamDayPlans||{};const key=`${team.id}|${date}`,override=Number(plans[key]?.capacityOverrideHours);return Number.isFinite(override)&&override>0?override:Math.max(.25,Number(team.capacityHours||8));}
function usedHours(teamId,date,exclude=''){return jobsFor(teamId,date).filter(j=>String(j.id)!==String(exclude)).reduce((sum,j)=>sum+durationHours(j,clientById(j.clientId)),0);}
function capacityState(team,date,exclude='',extra=0){const capacity=capacityHours(team,date),used=usedHours(team.id,date,exclude)+Number(extra||0),remaining=capacity-used;let key='available',label='';if(used>capacity+.25){key='over';label=`Over by ${durationLabel(used-capacity)}`;}else if(remaining<=.25){key='full';label='Full';}else if(remaining<=.75){key='near';label=`${durationLabel(remaining)} left`;}return {capacity,used,remaining,key,label};}
function recurring(job){return markerForJob(job)==='R';}
function snapshot(){const s=state();return JSON.stringify({schedules:s.schedules||[],scheduleBasket:s.scheduleBasket||[],scheduleOverflowQueue:s.scheduleOverflowQueue||[],quotes:s.quotes||[],clients:s.clients||[],serviceAgreements:s.serviceAgreements||[],serviceCommitments:s.serviceCommitments||[],catchUps:s.catchUps||[]});}
function restore(raw){const s=state(),p=JSON.parse(raw);for(const k of ['schedules','scheduleBasket','scheduleOverflowQueue','quotes','clients','serviceAgreements','serviceCommitments','catchUps'])s[k]=p[k]||[];}
async function persistWithRollback(before,message='Schedule updated.'){
  try{
    const saver=core()?.saveOperationalNow||core()?.save;
    if(typeof saver==='function')await saver.call(core());
    else window.save?.();
    toast(message);
    return true;
  }catch(error){
    console.error('[TuinBooks Schedule v60.8.6] save failed',error);
    restore(before);try{core()?.save?.();}catch(_){ }
    render();toast('The schedule change could not be saved. The previous schedule was restored.','error');return false;
  }
}

function weekSummary(week){const dates=weekDates(week),jobs=weekJobs(dates),completed=jobs.filter(j=>String(j.status||'').toLowerCase()==='completed').length,unresolved=jobs.filter(j=>String(j.date||'')<today()&&!TERMINAL.has(String(j.status||'scheduled').toLowerCase())).length;return {week,jobs:jobs.length,hours:jobs.reduce((s,j)=>s+durationHours(j,clientById(j.clientId)),0),completed,unresolved};}
function renderOverview(){
  const host=$('rollingScheduleOverview');if(!host)return;
  const selected=weekValue(),weeks=[];for(let i=0;i<8;i++)weeks.push(weekSummary(addDays(currentWeek(),i*7)));
  host.innerHTML=`<div class="tb6086-nav">
    <button type="button" class="button secondary compact" data-tb6086-week="-1">‹ Previous week</button>
    <button type="button" class="button secondary compact" data-tb6086-today>Today</button>
    <button type="button" class="button secondary compact" data-tb6086-week="1">Next week ›</button>
    <span class="tb6086-selected-week">${esc(fmtShort(selected))}–${esc(fmtShort(addDays(selected,5)))}</span>
    <span class="tb6086-spacer"></span>
    <span class="tb6086-drag-controls">
      ${dragMode?`<span class="tb6086-scope"><span>Move:</span><button type="button" data-tb6086-scope="once" class="${dragScope==='once'?'active':''}">This visit only</button><button type="button" data-tb6086-scope="future" class="${dragScope==='future'?'active':''}">This &amp; future visits</button></span>`:''}
      <button type="button" class="button ${dragMode?'':'secondary'} compact tb6086-drag-toggle ${dragMode?'active':''}" data-tb6086-drag>${dragMode?'Finish moving':'Rearrange schedule'}</button>
    </span>
  </div><div class="rolling-week-strip">${weeks.map(r=>`<button type="button" class="rolling-week-card ${r.week===selected?'active':''} ${r.unresolved?'attention':''}" data-tb6086-open-week="${r.week}"><span>${esc(fmtShort(r.week))}–${esc(fmtShort(addDays(r.week,5)))}</span><strong>${r.jobs} visit${r.jobs===1?'':'s'}</strong><small>${r.hours.toFixed(1)}h${r.unresolved?` · ${r.unresolved} unresolved`:''}</small></button>`).join('')}</div>`;
}

function actionRows(teamId,date){return actions.filter(a=>String(a.assignedId)===String(teamId)&&String(a.calendarDate)===String(date)&&String(a.status||'').toLowerCase()!=='cancelled').sort((a,b)=>(a.kind==='team_note'?0:1)-(b.kind==='team_note'?0:1)||String(a.calendarTime||'').localeCompare(String(b.calendarTime||'')));}
function actionHtml(a){const note=a.kind==='team_note';return `<button type="button" class="schedule-action-v6010 ${note?'instruction':'event'}" data-tb6086-action="${esc(a.id)}"><span>${note?'DAY INSTRUCTION':'AD-HOC EVENT'}</span><div><strong>${esc(note?(a.detail||'Day instruction'):(a.title||'Ad-hoc event'))}</strong>${!note&&a.detail?`<small>${esc(a.detail)}</small>`:''}</div>${a.calendarTime?`<time>${esc(a.calendarTime)}</time>`:''}</button>`;}
function cardHtml(job,team,date){const c=clientById(job.clientId)||{},status=String(job.status||'scheduled').toLowerCase(),completed=status==='completed',movable=!isPast(date)&&!TERMINAL.has(status),selected=false;return `<article role="button" tabindex="0" class="schedule-card-clean v59384-card tb6086-schedule-card ${completed?'completed':''}" style="--team-color:${esc(teamColour(team))}" data-job-id="${esc(job.id)}" draggable="${dragMode&&movable?'true':'false'}" aria-label="${esc(`${clientName(c)}, ${clientArea(c)}`)}">
  <span class="schedule-card-copy v6059-card-copy"><strong>${esc(clientName(c))}</strong><span class="schedule-card-suburb">${esc(clientArea(c))}</span></span>
  <span class="schedule-card-info-v58931" role="button" tabindex="0" data-tb6086-info="${esc(job.id)}" aria-label="Open job information">i</span>
</article>`;}
function groupCards(rows,team,date){const loose=[],groups=new Map();for(const job of rows){const c=clientById(job.clientId)||{},name=String(c.siteGroupName||'').trim();if(!name){loose.push(job);continue;}const key=name.toLowerCase();if(!groups.has(key))groups.set(key,{name,jobs:[]});groups.get(key).jobs.push(job);}const out=loose.map(j=>cardHtml(j,team,date));for(const g of groups.values()){if(g.jobs.length===1)out.push(cardHtml(g.jobs[0],team,date));else{const first=clientById(g.jobs[0].clientId)||{},access=first.siteGroupEntrance||first.siteGroupNotes||'Shared entrance';out.push(`<section class="schedule-destination-group"><header><div><strong>${esc(g.name)}</strong><span>${g.jobs.length} sites · ${esc(access)}</span></div><span>1 destination</span></header><div>${g.jobs.map(j=>cardHtml(j,team,date)).join('')}</div></section>`);}}return out.join('');}
function cellHtml(team,date){const rows=jobsFor(team.id,date),past=isPast(date),cap=capacityState(team,date),areas=[...new Set(rows.map(j=>clientArea(clientById(j.clientId))).filter(Boolean))],route=areas.length===1?areas[0]:areas.length>1?'Mixed route':past?'No bookings':'Open day',acts=actionRows(team.id,date);return `<section class="schedule-day-lane ${cap.key} ${past?'past':''}" data-team-id="${esc(team.id)}" data-date="${esc(date)}" style="--lane-min:${Math.max(260,Math.round(cap.capacity*52))}px">
<header class="schedule-lane-head"><div><strong>${esc(route)}</strong><span>${rows.length} visit${rows.length===1?'':'s'}</span></div><div class="schedule-lane-state ${cap.key}">${past?'🔒':esc(cap.label||'')}${!past?`<button type="button" data-tb6086-capacity="${esc(team.id)}|${esc(date)}" title="Adjust capacity">⋯</button>`:''}</div></header>
${!past?`<div class="tb6086-day-actions"><button type="button" data-tb6086-add-action="team_note" data-team-id="${esc(team.id)}" data-date="${esc(date)}">+ Note</button><button type="button" data-tb6086-add-action="internal_event" data-team-id="${esc(team.id)}" data-date="${esc(date)}">+ Event</button></div>`:''}
${acts.length?`<div class="schedule-actions-v6010">${acts.map(actionHtml).join('')}</div>`:''}
<div class="schedule-drop-preview" aria-hidden="true"></div><div class="schedule-lane-cards">${rows.length?groupCards(rows,team,date):`<span class="schedule-empty-lane">${past?'No bookings':dragMode?'Drop a job here':'Open day'}</span>`}</div></section>`;}
function renderBoard(){const host=$('weeklyScheduleBoard');if(!host)return;const dates=weekDates(weekValue()),teams=activeTeams();host.className='schedule-board';host.innerHTML=teams.length?`<div class="schedule-board-scroll"><div class="schedule-grid-clean" style="--day-count:${dates.length}"><div class="schedule-grid-corner"><strong>Team</strong><span>${teams.length} shown</span></div>${dates.map(d=>`<div class="schedule-day-heading ${isPast(d)?'past':''}"><strong>${esc(dayName(d))}</strong><span>${esc(fmtShort(d))}</span>${isPast(d)?'<small>🔒</small>':''}</div>`).join('')}${teams.map(t=>`<div class="schedule-team-heading" style="--team-color:${esc(teamColour(t))}"><strong>${esc(t.name||'Team')}</strong><span>${esc(t.leaderName||'')}</span><small>${esc(durationLabel(capacityHours(t,dates[0])))} normal day</small></div>${dates.map(d=>cellHtml(t,d)).join('')}`).join('')}</div></div>`:'<div class="v56-clear-state">Add a team before scheduling work.</div>';
const summary=$('scheduleWeekSummary');if(summary)summary.textContent=`${weekJobs(dates).length} visits · ${teams.length} team${teams.length===1?'':'s'}`;
const title=$('scheduleModeTitle');if(title)title.textContent='Visual weekly plan';const help=$('scheduleModeHelp');if(help)help.textContent=dragMode?'Move appointments between team-days or use the Basket on the left.':'Client names and areas stay visible. Turn on Rearrange schedule only when you need to move work.';}

function basketRows(){const s=state();s.scheduleBasket=Array.isArray(s.scheduleBasket)?s.scheduleBasket:[];s.scheduleOverflowQueue=Array.isArray(s.scheduleOverflowQueue)?s.scheduleOverflowQueue:[];const rows=[];
for(const item of s.scheduleBasket){const c=clientById(item.clientId)||{};rows.push({source:'basket',key:`basket:${item.id}`,item,client:c,marker:item.workMarker||markerForJob(item.jobPayload||item),hours:Math.max(.25,Number(item.estimatedHours||c.estimatedHours||1)),reason:item.reason||'Waiting to be scheduled'});}
for(const q of (s.quotes||[])){const status=String(q.status||'').toLowerCase(),scheduled=q.scheduled||(s.schedules||[]).some(j=>String(j.quoteId)===String(q.id)&&String(j.status||'').toLowerCase()!=='cancelled');if(!['approved','accepted'].includes(status)||scheduled)continue;const c=clientById(q.clientId)||{};rows.push({source:'quote',key:`quote:${q.id}`,quote:q,client:c,marker:'O',hours:Math.max(.25,Number(q.estimatedHours||q.durationHours||c.estimatedHours||1)),reason:String(q.description||q.title||q.notes||'Accepted quote')});}
for(const item of s.scheduleOverflowQueue){const c=clientById(item.clientId)||{};rows.push({source:'overflow',key:`overflow:${item.id}`,item,client:c,marker:item.workMarker||markerForJob(item),hours:Math.max(.25,Number(item.estimatedHours||c.estimatedHours||1)),reason:item.reason||'Could not fit'});}
for(const j of (s.schedules||[])){if(String(j.status||'').toLowerCase()!=='unscheduled'&&String(j.date||''))continue;if((s.scheduleBasket||[]).some(x=>String(x.sourceJobId)===String(j.id)))continue;const c=clientById(j.clientId)||{};rows.push({source:'unscheduled',key:`unscheduled:${j.id}`,job:j,client:c,marker:markerForJob(j),hours:durationHours(j,c),reason:'Unscheduled work'});}
const term=basketSearch.trim().toLowerCase();return rows.filter(r=>!term||`${clientName(r.client)} ${clientArea(r.client)} ${r.reason}`.toLowerCase().includes(term)).sort((a,b)=>clientName(a.client).localeCompare(clientName(b.client)));}
function basketCard(r){return `<article class="tb6086-basket-card" draggable="true" data-basket-key="${esc(r.key)}"><span class="tb6086-marker ${r.marker.toLowerCase()}">${r.marker}</span><div><strong>${esc(clientName(r.client))}</strong><span>${esc(clientArea(r.client))}</span><small>${esc(r.reason)} · ${esc(durationLabel(r.hours))}</small></div><span class="tb6086-grip">⋮⋮</span></article>`;}
function renderBasket(){const drawer=$('scheduleParkingLotV5537'),launcher=$('scheduleBasketLauncherV58931'),count=$('scheduleBasketLauncherCountV58931');if(!drawer||!launcher)return;const rows=basketRows();if(count)count.textContent=String(rows.length);launcher.classList.toggle('hidden',dragMode||basketOpen);launcher.hidden=dragMode||basketOpen;launcher.onclick=()=>openBasket();
if(dragMode){basketOpen=true;basketMinimised=false;}
if(!basketOpen){drawer.className='schedule-basket-panel-v58930 hidden';drawer.innerHTML='';return;}
const groups={R:rows.filter(r=>r.marker==='R'),O:rows.filter(r=>r.marker==='O')};drawer.className=`tb6086-basket ${dragMode?'drag-basket':'floating-basket'} ${basketMinimised?'minimised':''}`;
if(basketMinimised&&!dragMode){drawer.innerHTML=`<button type="button" class="tb6086-min-strip" data-tb6086-expand-basket>Basket <span>${rows.length}</span></button>`;return;}
drawer.innerHTML=`<header><div><strong>Schedule basket</strong><span>${rows.length} item${rows.length===1?'':'s'} · drag onto a team/day</span></div><div>${!dragMode?'<button type="button" class="icon-button" data-tb6086-minimise aria-label="Minimise">—</button>':''}<button type="button" class="icon-button" data-tb6086-close-basket aria-label="Close">×</button></div></header>${rows.length>8?`<input class="control tb6086-basket-search" value="${esc(basketSearch)}" placeholder="Search basket">`:''}<div class="tb6086-basket-list">${groups.R.length?`<section><h3>Recurring work <span>${groups.R.length}</span></h3>${groups.R.map(basketCard).join('')}</section>`:''}${groups.O.length?`<section><h3>Once-off work <span>${groups.O.length}</span></h3>${groups.O.map(basketCard).join('')}</section>`:''}${rows.length?'':'<div class="ui-empty compact">The basket is empty.</div>'}</div>`;}
function openBasket(){basketOpen=true;basketMinimised=false;renderBasket();}
function closeBasket(){if(dragMode){toast('Finish moving to close the Basket.');return;}basketOpen=false;basketMinimised=false;renderBasket();}

function applyFuturePattern(job){const s=state(),c=clientById(job.clientId),team=teamById(job.teamId);if(!c||!team)return 0;const anchor=String(job.date),day=dayName(anchor),index=DAYS.indexOf(day);c.preferredDay=day;c.teamId=team.id;c.preferredTeamId=team.id;c.recurrenceAnchorDate=anchor;(s.serviceAgreements||[]).filter(a=>String(a.clientId)===String(c.id)&&String(a.status||'').toLowerCase()==='active').forEach(a=>{a.preferredDays=[day];a.defaultTeamId=team.id;a.updatedAt=new Date().toISOString();(a.lines||[]).filter(l=>l.active!==false).forEach(l=>l.anchorDate=anchor);});let n=0;for(const future of (s.schedules||[])){if(String(future.id)===String(job.id)||String(future.clientId)!==String(job.clientId)||String(future.date||'')<=anchor||!recurring(future)||future.manualOverride===true||TERMINAL.has(String(future.status||'scheduled').toLowerCase()))continue;future.date=addDays(startWeek(future.date),Math.max(0,index));future.teamId=team.id;future.autoAssigned=true;future.updatedAt=new Date().toISOString();n++;}return n;}
function basketItemFromJob(job){const s=state(),c=clientById(job.clientId)||{};s.scheduleBasket=Array.isArray(s.scheduleBasket)?s.scheduleBasket:[];let item=s.scheduleBasket.find(x=>String(x.sourceJobId)===String(job.id));const payload={id:item?.id||uid('basket'),sourceJobId:job.id,clientId:job.clientId,originalDate:item?.originalDate||job.date,originalTeamId:item?.originalTeamId||job.teamId,weekStart:item?.weekStart||startWeek(job.date),estimatedHours:durationHours(job,c),serviceIds:[...(job.serviceIds||[])],workTypeIds:[...(job.workTypeIds||c.workTypeIds||[])],clusterId:job.clusterId||c.clusterId||'',quoteId:job.quoteId||'',workKind:job.workKind||'',revenueType:job.revenueType||'',workMarker:markerForJob(job),reason:'Removed from the calendar by the office',jobPayload:JSON.parse(JSON.stringify(job)),createdAt:item?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(item)Object.assign(item,payload);else{s.scheduleBasket.push(payload);item=payload;}return item;}
async function moveJobToBasket(jobId){const s=state(),job=(s.schedules||[]).find(j=>String(j.id)===String(jobId));if(!job)return false;if(TERMINAL.has(String(job.status||'scheduled').toLowerCase())){toast('Completed or resolved appointments stay in history.','error');return false;}const before=snapshot();basketItemFromJob(job);s.schedules=(s.schedules||[]).filter(j=>String(j.id)!==String(job.id));if(job.quoteId){const q=quoteById(job.quoteId);if(q){q.scheduled=false;delete q.scheduledDate;delete q.scheduledTeamId;delete q.scheduledJobId;}}render();return persistWithRollback(before,`${clientName(clientById(job.clientId))} moved to the Schedule basket.`);}
function rowByKey(key){return basketRows().find(r=>r.key===key)||null;}
function placeRow(row,teamId,date){const s=state(),c=row.client||{};let job=null;if(row.source==='basket'){const item=row.item,src=JSON.parse(JSON.stringify(item.jobPayload||{}));job={...src,id:item.sourceJobId||src.id||uid('sch'),date,teamId,status:'scheduled',sort:100,manualOverride:true,autoGenerated:false,autoAssigned:false,estimatedHours:row.hours,serviceIds:[...(item.serviceIds||src.serviceIds||[])],workTypeIds:[...(item.workTypeIds||src.workTypeIds||c.workTypeIds||[])]};s.schedules.push(job);s.scheduleBasket=(s.scheduleBasket||[]).filter(x=>String(x.id)!==String(item.id));if(item.newRecurringV6036===true){c.awaitingInitialRecurringPlacementV6036=false;c.preferredDay=dayName(date);c.teamId=teamId;c.preferredTeamId=teamId;c.recurrenceAnchorDate=date;c.serviceStartDate=date;job.workKind='recurring';job.revenueType='Recurring contract';job.workMarker='R';}}
else if(row.source==='quote'){const q=row.quote;job={id:uid('sch'),date,clientId:c.id,teamId,status:'scheduled',estimatedHours:row.hours,sort:100,manualOverride:true,autoGenerated:false,autoAssigned:false,quoteId:q.id,workKind:'once-off',revenueType:'Once-off work',workMarker:'O',serviceIds:[...(q.serviceIds||[])],workTypeIds:[...(q.workTypeIds||c.workTypeIds||[])]};s.schedules.push(job);q.scheduled=true;q.scheduledAt=new Date().toISOString();q.scheduledDate=date;q.scheduledTeamId=teamId;q.scheduledJobId=job.id;}
else if(row.source==='overflow'){const item=row.item;job={id:uid('sch'),date,clientId:c.id,teamId,status:'scheduled',estimatedHours:row.hours,sort:100,manualOverride:true,autoGenerated:false,autoAssigned:false,quoteId:item.quoteId||'',workKind:item.workKind||'',revenueType:item.revenueType||'',workMarker:item.workMarker||row.marker,serviceIds:[...(item.serviceIds||[])],workTypeIds:[...(item.workTypeIds||c.workTypeIds||[])]};s.schedules.push(job);s.scheduleOverflowQueue=(s.scheduleOverflowQueue||[]).filter(x=>String(x.id)!==String(item.id));}
else if(row.source==='unscheduled'){job=row.job;job.date=date;job.teamId=teamId;job.status='scheduled';job.manualOverride=true;job.autoGenerated=false;}
if(job){const lane=jobsFor(teamId,date).filter(j=>String(j.id)!==String(job.id));job.sort=(lane.reduce((m,j)=>Math.max(m,routeOrder(j)),0)||0)+10;}return job;}
async function dropOnDay(teamId,date){if(!dragMode||isPast(date)||!activeDrag)return;const before=snapshot();let message='Schedule updated.';if(activeDrag.type==='job'){const job=(state().schedules||[]).find(j=>String(j.id)===String(activeDrag.id));if(!job)return;job.teamId=teamId;job.date=date;job.manualOverride=true;job.sort=(jobsFor(teamId,date).filter(j=>String(j.id)!==String(job.id)).reduce((m,j)=>Math.max(m,routeOrder(j)),0)||0)+10;if(dragScope==='future'&&recurring(job)){const n=applyFuturePattern(job);message=`Recurring pattern updated.${n?` ${n} future visit${n===1?'':'s'} moved.`:''}`;}else message='This visit moved. Future recurring visits are unchanged.';}
else if(activeDrag.type==='basket'){const row=rowByKey(activeDrag.key);if(!row)return;placeRow(row,teamId,date);message=`${clientName(row.client)} placed on ${dayName(date)}.`;}
activeDrag=null;render();await persistWithRollback(before,message);}

function normaliseAction(row){const p=row?.payload||{};return {id:String(row?.id||p.id||''),title:String(row?.title||p.title||''),detail:String(row?.detail||p.detail||''),status:String(row?.status||p.status||'scheduled'),assignedId:String(row?.assigned_id||p.assignedId||''),calendarDate:String(row?.calendar_date||p.calendarDate||'').slice(0,10),calendarTime:String(row?.calendar_time||p.calendarTime||'').slice(0,5),kind:String(p.kindV6010||p.kindV6005||p.kindV59694||'')};}
async function loadActions(force=false){const b=backend();if(!b?.client||!b?.businessId||b.mode!=='supabase')return;if(actionPromise)return actionPromise;if(!force&&actionsBusiness===String(b.businessId)&&Date.now()-actionsLoadedAt<15000)return;actionPromise=(async()=>{try{const {data,error}=await b.client.from('operational_actions_v59674').select('*').eq('business_id',b.businessId).order('calendar_date',{ascending:true});if(error)throw error;actions=(data||[]).map(normaliseAction).filter(a=>['team_note','internal_event'].includes(a.kind));actionsBusiness=String(b.businessId);actionsLoadedAt=Date.now();render();}catch(e){console.warn('[v60.8.6] action load',e);}finally{actionPromise=null;}})();return actionPromise;}
function actionDialog(){let d=$('scheduleActionDialogV6086');if(!d){d=document.createElement('dialog');d.id='scheduleActionDialogV6086';d.className='dialog schedule-action-dialog-v6010';document.body.appendChild(d);}return d;}
function openAction(kind,teamId,date,existing=null){const note=kind==='team_note',d=actionDialog();d.innerHTML=`<form class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">${note?'Shown first on the team route':'Non-client calendar item'}</span><h2>${existing?'Edit ':'New '}${note?'day instruction':'ad-hoc event'}</h2></div><button type="button" class="icon-button" data-close>×</button></div><div class="form-grid two"><label>Date *<input data-date type="date" required value="${esc(existing?.calendarDate||date)}"></label><label>Team *<select data-team>${activeTeams().map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(existing?.assignedId||teamId)?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>${note?'':`<label>Time<input data-time type="time" value="${esc(existing?.calendarTime||'')}"></label><label>Event title *<input data-title required value="${esc(existing?.title||'')}"></label>`}<label class="span-two">${note?'Instruction *':'Details'}<textarea data-detail rows="4" ${note?'required':''}>${esc(existing?.detail||'')}</textarea></label></div><div class="dialog-actions">${existing?'<button type="button" class="button danger secondary" data-remove>Remove</button>':''}<button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">Save</button></div></form>`;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.querySelector('[data-remove]')?.addEventListener('click',async()=>{await saveAction({...existing,status:'cancelled'});d.close();});d.querySelector('form').onsubmit=async e=>{e.preventDefault();const row={...(existing||{}),id:existing?.id||uid('action'),kind,title:note?'Day instruction':d.querySelector('[data-title]')?.value.trim()||'',detail:d.querySelector('[data-detail]').value.trim(),status:'scheduled',assignedId:d.querySelector('[data-team]').value,calendarDate:d.querySelector('[data-date]').value,calendarTime:note?'':d.querySelector('[data-time]')?.value||''};await saveAction(row);d.close();};try{d.showModal();}catch{d.setAttribute('open','');}}
async function saveAction(a){const b=backend();if(!b?.client||!b?.businessId||b.mode!=='supabase'){toast('Open the live business workspace before saving this calendar item.','error');return;}const payload={kindV6010:a.kind,kindV6005:a.kind,kindV59694:a.kind,createdByFeature:'clean-schedule-v6086'};const row={id:a.id,title:a.title,detail:a.detail,status:a.status,assignedType:'team',assignedId:a.assignedId,calendarDate:a.calendarDate,calendarTime:a.calendarTime,payload,kindV6010:a.kind};const params=new URLSearchParams(location.search),session=params.get('support')==='1'?(params.get('session')||null):null;const {error}=await b.client.rpc('tuinbooks_save_operational_action_v6011',{p_business_id:b.businessId,p_row:row,p_support_session_id:session});if(error){toast(String(error.message||error),'error');return;}await loadActions(true);toast(a.status==='cancelled'?'Calendar item removed.':'Calendar item saved.');}

function cleanupLegacyChrome(){document.getElementById('scheduleToolbarV6006')?.remove();document.body?.classList.remove('v6007-basket-open','schedule-drag-mode-active-v6059','schedule-drag-mode-active-v6061');const board=$('weeklyScheduleBoard');if(board)board.classList.remove('v6006-board','v6007-board');}

function render(){if(rendering)return;rendering=true;try{const root=$('view-schedule');if(!root)return;cleanupLegacyChrome();const s=state();if(!Array.isArray(s.schedules)||!Array.isArray(s.teams))return;const picker=$('scheduleWeekPicker');if(picker&&!picker.value)picker.value=currentWeek();renderOverview();renderBoard();renderBasket();root.dataset.scheduleOwner='v6086-clean';document.documentElement.dataset.scheduleRenderer='v6086-clean';const sig=`${s.teams.length}|${s.schedules.length}|${weekValue()}|${dragMode}|${basketOpen}`;lastRenderSignature=sig;loadActions(false);}finally{rendering=false;}}

function setDragMode(on){dragMode=!!on;if(dragMode){basketOpen=true;basketMinimised=false;}else{activeDrag=null;basketOpen=false;basketMinimised=false;}document.body?.classList.toggle('schedule-drag-mode-active-v6086',dragMode);render();toast(dragMode?`Rearrange mode on — ${dragScope==='future'?'this & future visits':'this visit only'}.`:'Schedule locked.');}
function setScope(scope){dragScope=scope==='future'?'future':'once';try{localStorage.setItem(STORAGE_SCOPE,dragScope);}catch(_){ }render();toast(`Move: ${dragScope==='future'?'this & future visits':'this visit only'}.`);}

function eventHandlers(){
  document.addEventListener('click',e=>{
    const root=e.target?.closest?.('#view-schedule');if(!root)return;
    const week=e.target.closest('[data-tb6086-week]');if(week){e.preventDefault();setWeek(addDays(weekValue(),Number(week.dataset.tb6086Week)*7));return;}
    if(e.target.closest('[data-tb6086-today]')){e.preventDefault();setWeek(currentWeek());return;}
    const ow=e.target.closest('[data-tb6086-open-week]');if(ow){e.preventDefault();setWeek(ow.dataset.tb6086OpenWeek);return;}
    if(e.target.closest('[data-tb6086-drag]')){e.preventDefault();setDragMode(!dragMode);return;}
    const scope=e.target.closest('[data-tb6086-scope]');if(scope){e.preventDefault();setScope(scope.dataset.tb6086Scope);return;}
    if(e.target.closest('[data-tb6086-expand-basket]')){e.preventDefault();basketMinimised=false;basketOpen=true;renderBasket();return;}
    if(e.target.closest('[data-tb6086-minimise]')){e.preventDefault();basketMinimised=true;renderBasket();return;}
    if(e.target.closest('[data-tb6086-close-basket]')){e.preventDefault();closeBasket();return;}
    const info=e.target.closest('[data-tb6086-info]');if(info){e.preventDefault();e.stopPropagation();core()?.openJob?.(info.dataset.tb6086Info);return;}
    const card=e.target.closest('.schedule-card-clean[data-job-id]');if(card&&!dragMode){e.preventDefault();core()?.openJob?.(card.dataset.jobId);return;}
    const cap=e.target.closest('[data-tb6086-capacity]');if(cap){e.preventDefault();e.stopPropagation();const [t,d]=cap.dataset.tb6086Capacity.split('|');core()?.adjustDay?.(t,d);return;}
    const add=e.target.closest('[data-tb6086-add-action]');if(add){e.preventDefault();e.stopPropagation();openAction(add.dataset.tb6086AddAction,add.dataset.teamId,add.dataset.date);return;}
    const act=e.target.closest('[data-tb6086-action]');if(act){e.preventDefault();e.stopPropagation();const a=actions.find(x=>x.id===act.dataset.tb6086Action);if(a)openAction(a.kind,a.assignedId,a.calendarDate,a);return;}
  },true);
  document.addEventListener('input',e=>{if(e.target?.matches?.('#view-schedule .tb6086-basket-search')){basketSearch=e.target.value||'';renderBasket();}},true);
  document.addEventListener('dragstart',e=>{const card=e.target?.closest?.('#view-schedule .schedule-card-clean[data-job-id]');if(card){if(!dragMode){e.preventDefault();return;}activeDrag={type:'job',id:card.dataset.jobId};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/json',JSON.stringify(activeDrag));return;}const basket=e.target?.closest?.('#view-schedule .tb6086-basket-card[data-basket-key]');if(basket){if(!dragMode){e.preventDefault();toast('Turn on Rearrange schedule to place Basket items.');return;}activeDrag={type:'basket',key:basket.dataset.basketKey};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/json',JSON.stringify(activeDrag));}},true);
  document.addEventListener('dragover',e=>{const lane=e.target?.closest?.('#view-schedule .schedule-day-lane[data-team-id][data-date]');if(lane&&dragMode&&!isPast(lane.dataset.date)){e.preventDefault();lane.classList.add('drag-preview');e.dataTransfer.dropEffect='move';return;}const basket=e.target?.closest?.('#view-schedule .tb6086-basket');if(basket&&dragMode&&activeDrag?.type==='job'){e.preventDefault();basket.classList.add('is-drop-target');}},true);
  document.addEventListener('dragleave',e=>{const lane=e.target?.closest?.('.schedule-day-lane');if(lane&&!lane.contains(e.relatedTarget))lane.classList.remove('drag-preview');const basket=e.target?.closest?.('.tb6086-basket');if(basket&&!basket.contains(e.relatedTarget))basket.classList.remove('is-drop-target');},true);
  document.addEventListener('drop',async e=>{const lane=e.target?.closest?.('#view-schedule .schedule-day-lane[data-team-id][data-date]');if(lane&&dragMode){e.preventDefault();lane.classList.remove('drag-preview');await dropOnDay(lane.dataset.teamId,lane.dataset.date);return;}const basket=e.target?.closest?.('#view-schedule .tb6086-basket');if(basket&&dragMode&&activeDrag?.type==='job'){e.preventDefault();basket.classList.remove('is-drop-target');const id=activeDrag.id;activeDrag=null;await moveJobToBasket(id);}},true);
  document.addEventListener('dragend',()=>{activeDrag=null;document.querySelectorAll('#view-schedule .drag-preview').forEach(n=>n.classList.remove('drag-preview'));document.querySelectorAll('#view-schedule .is-drop-target').forEach(n=>n.classList.remove('is-drop-target'));},true);
}

window.openScheduleQueue=openBasket;
window.closeScheduleQueue=closeBasket;
window.toggleScheduleBasketMinimisedV58931=()=>{basketMinimised=!basketMinimised;basketOpen=true;renderBasket();};
window.renderScheduleQueue=renderBasket;
window.isScheduleDragModeV6059=()=>dragMode;
window.getScheduleDragScopeV6059=()=>dragScope;
window.toggleScheduleDragModeV6059=(force)=>setDragMode(typeof force==='boolean'?force:!dragMode);
window.setScheduleDragScopeV6059=setScope;
window.__tuinbooksScheduleEngineV6086={build:BUILD,render,renderBoard,renderOverview,renderBasket,openBasket,closeBasket,setDragMode,setScope,basketRows,moveJobToBasket,dropOnDay};

function boot(){eventHandlers();document.body?.classList.remove('schedule-drag-mode-active-v6059','schedule-drag-mode-active-v6061');setDragMode(false);render();window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>{render();const rolling=core()?.rolling?.();try{rolling?.refresh?.('schedule-clean-runtime-ready',220);}catch(_){ }},0));document.addEventListener('click',e=>{if(e.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>{render();const rolling=core()?.rolling?.();try{rolling?.refresh?.('schedule-clean-open',180);}catch(_){ }},50);},true);console.info('[TuinBooks Schedule]',BUILD);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
