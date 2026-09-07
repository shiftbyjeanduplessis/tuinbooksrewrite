/* TuinBooks v59.6.94 — stability, onboarding and historical-work repair
   Deliberately layered on the known v59.6.93 runtime. It does NOT load the
   abandoned parallel-branch modules. The repair uses the v59.6.91 live-binding
   bridge and verified existing operational tables where available.
*/
(()=>{
'use strict';
const BUILD='59.6.98-work-page-single-today';
if(window.__tuinbooksStabilityRepairV59694===BUILD)return;

const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const $=id=>document.getElementById(id);
const safeText=value=>String(value??'').trim();
const esc94=value=>typeof window.esc==='function'?window.esc(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localISO=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;};
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
const dateObj=value=>new Date(`${String(value||'').slice(0,10)}T12:00:00`);
const weekday=value=>validDate(value)?DAYS[dateObj(value).getDay()]:'';
const fmtDate94=value=>validDate(value)?dateObj(value).toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):safeText(value)||'—';
const teamById94=id=>(window.state?.teams||[]).find(team=>String(team.id)===String(id))||null;
const clientById94=id=>typeof window.clientById==='function'?window.clientById(id):(window.state?.clients||[]).find(client=>String(client.id)===String(id))||null;
const profileById94=id=>(window.state?.billingProfilesV59396||[]).find(profile=>String(profile.id)===String(id))||null;
const activeTeams94=()=> (window.state?.teams||[]).filter(team=>team.active!==false);
const terminalJob94=status=>['completed','cancelled','canceled','deferred','rescheduled','no-charge','access-failed','archived','deleted'].includes(String(status||'').toLowerCase());
const completedVisit94=visit=>/^completed$/i.test(String(visit?.outcome||visit?.status||''))||String(visit?.outcome||'')==='Completed';
const recurring94=client=>{
  if(!client||String(client.status||'active').toLowerCase()!=='active')return false;
  const kind=String(client.recordKindV58951||'').toLowerCase(),freq=String(client.frequency||'').toLowerCase(),state=String(client.serviceState||'').toLowerCase();
  if(kind==='quote-contact'||kind==='once-off-customer'||['quote-only','once-off','archived','paused','cancelled'].includes(state))return false;
  return !/ad hoc|once[- ]?off/.test(freq);
};
const regularRecurring94=client=>/weekly|fortnight|bi.?weekly|month/.test(String(client?.frequency||'').toLowerCase());
const customFrequency94=client=>/custom/.test(String(client?.frequency||'').toLowerCase());
const rate94=client=>Math.max(0,Number(client?.rateAmount||client?.perVisitRate||client?.visitRate||client?.monthlyFee||0));
const explicitServices94=client=>Array.isArray(client?.serviceIds)?client.serviceIds.filter(Boolean):[];
const trackingStart94=()=>safeText(window.state?.business?.operationalTrackingStartDateV59694);

function ensureBusiness94(){window.state.business=window.state.business||{};return window.state.business;}
function safeSave94(){try{const result=window.save?.();if(result&&typeof result.catch==='function')result.catch(error=>console.warn('[TuinBooks 59.6.94] save',error));return result;}catch(error){console.warn('[TuinBooks 59.6.94] save',error);}}
function toast94(message,tone){try{window.toast?.(message,tone);}catch(_){}}

/* -----------------------------------------------------------------------
   1) Imported-history boundary.
   Nothing is changed until the office explicitly chooses a tracking start.
   ----------------------------------------------------------------------- */
if(document.body?.dataset?.app==='desktop'&&typeof window.scheduleJobNeedsOfficeActionV58928==='function'&&!window.scheduleJobNeedsOfficeActionV58928.__v59694){
  const before=window.scheduleJobNeedsOfficeActionV58928;
  const wrapped=function(job){const start=trackingStart94();if(start&&job?.date&&String(job.date)<start)return false;return before(job);};
  wrapped.__v59694=true;window.scheduleJobNeedsOfficeActionV58928=wrapped;
}
if(document.body?.dataset?.app==='desktop'&&typeof window.missingScheduleRowsV56==='function'&&!window.missingScheduleRowsV56.__v59694){
  const before=window.missingScheduleRowsV56;
  const wrapped=function(...args){const rows=before(...args)||[],start=trackingStart94();return start?rows.filter(job=>!job?.date||String(job.date)>=start):rows;};
  wrapped.__v59694=true;window.missingScheduleRowsV56=wrapped;
}

/* -----------------------------------------------------------------------
   2) Historical Work = date -> team -> expected work / actual result.
   ----------------------------------------------------------------------- */
function linkedVisitMap94(){const map=new Map();for(const visit of (window.state?.visits||[])){if(visit?.scheduledJobId)map.set(String(visit.scheduledJobId),visit);}return map;}
function workStatus94(job,visit,date){
  const start=trackingStart94();
  if(start&&date<start)return {key:'history',label:'Imported history'};
  if(visit){if(completedVisit94(visit))return {key:'complete',label:'Completed'};return {key:'exception',label:safeText(visit.outcome)||'Exception'};}
  const st=String(job?.status||'scheduled').toLowerCase();
  if(st==='completed')return {key:'complete',label:'Completed'};
  if(['cancelled','canceled'].includes(st))return {key:'resolved',label:'Cancelled'};
  if(st==='rescheduled')return {key:'resolved',label:'Rescheduled'};
  if(st==='deferred')return {key:'resolved',label:'Deferred'};
  if(st==='no-charge')return {key:'resolved',label:'No charge'};
  if(st==='access-failed')return {key:'exception',label:'Access failed'};
  if(date===localISO())return {key:'scheduled',label:'Scheduled'};
  return {key:'unresolved',label:'Missed / unresolved'};
}
function teamWorkModel94(date,teamId,jobs,visits,linked){
  const team=teamById94(teamId)||{id:teamId,name:'No team'};
  const teamJobs=jobs.filter(job=>String(job.teamId||'')===String(teamId));
  const unplanned=visits.filter(v=>String(v.teamId||'')===String(teamId)&&!v.scheduledJobId);
  const cards=teamJobs.map(job=>({job,visit:linked.get(String(job.id))||null,status:workStatus94(job,linked.get(String(job.id))||null,date)}));
  const completed=cards.filter(row=>row.status.key==='complete').length;
  const remaining=cards.filter(row=>row.status.key==='scheduled').length;
  const unresolved=cards.filter(row=>row.status.key==='unresolved').length;
  const exceptions=cards.filter(row=>row.status.key==='exception').length;
  return {team,cards,unplanned,scheduled:teamJobs.length,completed,remaining,unresolved,exceptions,records:cards.filter(r=>r.visit).length+unplanned.length};
}
function workTeamHistoryHtml94(){
  const hostMonth=$('recordsMonth')?.value||localISO().slice(0,7),today=localISO(),start=trackingStart94();
  const teamFilter=$('recordTeamFilter')?.value||'all';
  const jobs=(window.state?.schedules||[]).filter(job=>String(job.date||'').startsWith(hostMonth)&&String(job.date||'')<=today);
  const visits=(window.state?.visits||[]).filter(visit=>String(visit.date||visit.workDate||'').startsWith(hostMonth)&&String(visit.date||visit.workDate||'')<=today);
  const dates=[...new Set([...jobs.map(j=>String(j.date||'')),...visits.map(v=>String(v.date||v.workDate||''))].filter(validDate))].sort().reverse();
  const linked=linkedVisitMap94();
  const rows=dates.map((date,index)=>{
    const dateJobs=jobs.filter(j=>j.date===date),dateVisits=visits.filter(v=>(v.date||v.workDate)===date);
    const teamIds=[...new Set([...dateJobs.map(j=>j.teamId),...dateVisits.map(v=>v.teamId)].filter(Boolean))].filter(id=>teamFilter==='all'||String(id)===String(teamFilter));
    if(!teamIds.length)return '';
    const models=teamIds.map(id=>teamWorkModel94(date,id,dateJobs,dateVisits,linked)).sort((a,b)=>String(a.team.name||'').localeCompare(String(b.team.name||'')));
    const totals=models.reduce((a,m)=>({scheduled:a.scheduled+m.scheduled,completed:a.completed+m.completed,remaining:a.remaining+m.remaining,unresolved:a.unresolved+m.unresolved,exceptions:a.exceptions+m.exceptions}),{scheduled:0,completed:0,remaining:0,unresolved:0,exceptions:0});
    const historical=start&&date<start;
    const todayProgress=date===today&&!historical;
    return `<details class="work-team-day-v59694 ${date===today?'today':''}" ${date===today||index<2?'open':''}><summary><div><span class="eyebrow">${date===today?'Today':'Workday'}</span><strong>${esc94(fmtDate94(date))}</strong></div><div class="work-team-day-totals-v59694"><span>${totals.scheduled} scheduled</span><span class="ok">${totals.completed} completed</span>${historical?'<span>Imported history</span>':todayProgress?`<span class="remaining">${totals.remaining} remaining</span>`:totals.unresolved?`<span class="bad">${totals.unresolved} unresolved</span>`:''}${totals.exceptions?`<span class="warn">${totals.exceptions} exception${totals.exceptions===1?'':'s'}</span>`:''}</div></summary><div class="work-team-groups-v59694">${models.map(model=>`<section class="work-team-section-v59694"><header><div><span class="team-dot-v59694" style="--team:${esc94(model.team.color||model.team.colour||'#708078')}"></span><strong>${esc94(model.team.name||'No team')}</strong></div><div class="work-team-metrics-v59694"><b>${model.scheduled}</b><small>scheduled</small><b>${model.completed}</b><small>completed</small>${historical?'':todayProgress?`<b>${model.remaining}</b><small>remaining</small>`:`<b class="${model.unresolved?'bad':''}">${model.unresolved}</b><small>unresolved</small>`}</div></header><div class="work-team-job-list-v59694">${model.cards.map(({job,visit,status})=>{const client=clientById94(job.clientId)||{},actualTeam=visit?.teamId&&String(visit.teamId)!==String(job.teamId)?teamById94(visit.teamId)?.name||'another team':'';return `<div class="work-team-job-v59694 status-${status.key}"><span><strong>${esc94(client.name||client.address||'Unknown client')}</strong><small>${esc94(client.address||client.suburb||'Address missing')}${actualTeam?` · recorded by ${esc94(actualTeam)}`:''}</small></span><span class="work-status-v59694">${esc94(status.label)}</span></div>`;}).join('')}${model.unplanned.map(visit=>{const client=clientById94(visit.clientId)||{};return `<div class="work-team-job-v59694 status-${completedVisit94(visit)?'complete':'exception'}"><span><strong>${esc94(client.name||'Unscheduled work')}</strong><small>Work record not linked to a scheduled visit</small></span><span class="work-status-v59694">${esc94(visit.outcome||'Recorded')}</span></div>`;}).join('')||(!model.cards.length?'<div class="ui-empty compact">No work for this team.</div>':'')}</div></section>`).join('')}</div></details>`;
  }).filter(Boolean).join('');
  return rows||'<div class="ui-empty">No scheduled or recorded work in this month.</div>';
}
function renderWorkTeamHistory94(){
  const view=$('view-records'),cards=$('workRecordCards');if(!view||!cards)return;
  let panel=$('workTeamHistoryV59694');
  if(!panel){panel=document.createElement('section');panel.id='workTeamHistoryV59694';panel.className='work-team-history-v59694 work-history-settings-v59698';cards.after(panel);}
  else if(panel.previousElementSibling!==cards){cards.after(panel);}
  const start=trackingStart94();
  panel.innerHTML=`<details class="panel work-tracking-control-v59694 work-tracking-control-v59698"><summary><div><span class="eyebrow">History settings</span><strong>Operational tracking start</strong><small>${start?`Visits before ${esc94(fmtDate94(start))} are treated as imported/reference history.`:'Set this only when the client confirms the first real TuinBooks operating day.'}</small></div><span aria-hidden="true">⌄</span></summary><div class="work-tracking-control-body-v59698"><label>Tracking starts<input type="date" id="operationalTrackingStartV59694" value="${esc94(start)}"><small>This affects past unresolved-work accountability only. It does not delete schedule history.</small></label></div></details>`;
  const input=$('operationalTrackingStartV59694');if(input)input.onchange=()=>{ensureBusiness94().operationalTrackingStartDateV59694=input.value||'';safeSave94();window.renderRecords?.();window.renderSchedule?.();toast94(input.value?'Operational tracking start saved. Earlier diary rows are now reference history.':'Operational tracking start cleared.');};
}

/* -----------------------------------------------------------------------
   3) Onboarding readiness and explicit recurrence activation.
   ----------------------------------------------------------------------- */
function agreementRows94(client){return (window.state?.serviceAgreements||[]).filter(row=>String(row.clientId)===String(client.id));}
function latestClientJob94(client){return (window.state?.schedules||[]).filter(j=>String(j.clientId)===String(client.id)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||null;}
function futureClientJobs94(client){const today=localISO();return (window.state?.schedules||[]).filter(j=>String(j.clientId)===String(client.id)&&String(j.date||'')>=today&&!['cancelled','canceled','deleted','archived'].includes(String(j.status||'').toLowerCase()));}
function clientReadiness94(client){
  const blockers=[],warnings=[];
  if(!safeText(client?.name))blockers.push('client name');
  if(!safeText(client?.address))blockers.push('service address');
  if(!safeText(client?.suburb))blockers.push('suburb / route area');
  if(!explicitServices94(client).length)blockers.push('actual services');
  const freq=safeText(client?.frequency);
  if(!freq||/not classified/i.test(freq))blockers.push('service frequency');
  if(rate94(client)<=0)blockers.push('agreed rate');
  const profile=profileById94(client?.billingProfileIdV59396);
  if(!client?.billingProfileIdV59396||!profile)blockers.push('Billing Profile');
  if(!safeText(client?.whatsapp)&&!safeText(client?.email))warnings.push('no phone/email');
  if(recurring94(client)&&regularRecurring94(client)){
    const day=safeText(client.preferredDay),anchor=safeText(client.recurrenceAnchorDate||client.serviceStartDate),teamId=safeText(client.preferredTeamId||client.teamId),agreements=agreementRows94(client),active=agreements.some(a=>String(a.status||'').toLowerCase()==='active');
    if(!DAYS.includes(day))blockers.push('confirmed recurring day');
    if(!validDate(anchor))blockers.push('recurrence anchor');
    else if(DAYS.includes(day)&&weekday(anchor)!==day)blockers.push('recurring day does not match anchor');
    if(!teamId||!teamById94(teamId))blockers.push('confirmed team');
    if(!active)blockers.push('active service agreement');
    if(client.autoScheduleEnabled!==true||client.scheduleSource==='diary'||client.schedulingPolicyV58951==='manual-schedule-import')blockers.push('automatic recurrence not activated');
    if(client.autoScheduleEnabled===true&&!futureClientJobs94(client).length)blockers.push('no future recurring visit');
  }else if(recurring94(client)&&customFrequency94(client)){
    blockers.push('custom recurrence requires a confirmed manual rule');
  }
  return {blockers:[...new Set(blockers)],warnings:[...new Set(warnings)],ready:blockers.length===0};
}
function profileIssues94(profile){
  const issues=[];if(!profile)return ['profile missing'];
  const name=safeText(profile.legalName||profile.displayName);if(!name||/^temporary$/i.test(name))issues.push('legal/display name');
  if(!safeText(profile.billingAddress))issues.push('billing address');
  if(!safeText(profile.registrationNumber))issues.push('registration number / explicit N/A');
  if(!safeText(profile.email))issues.push('accounts email / explicit N/A');
  if(!safeText(profile.phone))issues.push('phone / explicit N/A');
  if(!safeText(profile.bankName)&&!safeText(profile.bankAccountNumber)&&!safeText(profile.legacyBankingText))issues.push('bank/payment details / explicit omission');
  if(Number(profile.invoiceNextNumber||1)===1)issues.push('starting invoice number confirmation');
  return issues;
}
function readinessRows94(){return (window.state?.clients||[]).filter(recurring94).map(client=>({client,...clientReadiness94(client)}));}
function renderOnboardingReadiness94(){
  const host=$('clientSetupPanel');if(!host)return;
  const rows=readinessRows94(),needs=rows.filter(r=>!r.ready),warnings=rows.filter(r=>r.warnings.length),profiles=(window.state?.billingProfilesV59396||[]).filter(p=>p.isActive!==false),badProfiles=profiles.map(p=>({p,issues:profileIssues94(p)})).filter(x=>x.issues.length);
  host.classList.add('onboarding-readiness-v59694');
  host.innerHTML=`<div class="onboarding-head-v59694"><div><span class="eyebrow">Go-live readiness</span><h2>${rows.length-needs.length} of ${rows.length} recurring clients production-ready</h2><p>TuinBooks no longer treats a name and calendar slot as complete onboarding. Address, services, recurrence, team, rate and issuing entity are checked separately.</p></div><div class="readiness-metrics-v59694"><span><b>${needs.length}</b> need setup</span><span><b>${warnings.length}</b> warnings</span><span class="${badProfiles.length?'bad':''}"><b>${badProfiles.length}</b> Billing Profiles need confirmation</span></div></div>${needs.length?`<details class="readiness-list-v59694" open><summary>Review setup gaps</summary><div>${needs.slice(0,30).map(row=>{const diary=row.client.autoScheduleEnabled===false||row.client.scheduleSource==='diary'||row.client.schedulingPolicyV58951==='manual-schedule-import';return `<article><div><strong>${esc94(row.client.name||'Unnamed client')}</strong><small>${esc94(row.blockers.join(' · '))}</small></div><div>${diary&&regularRecurring94(row.client)?`<button type="button" class="button compact" onclick="openRecurrenceConfirmationV59694('${esc94(row.client.id)}')">Review recurrence</button>`:''}<button type="button" class="button secondary compact" onclick="editClient('${esc94(row.client.id)}')">Open client</button></div></article>`;}).join('')}${needs.length>30?`<p class="readiness-more-v59694">${needs.length-30} more clients also need setup.</p>`:''}</div></details>`:'<div class="readiness-pass-v59694">All recurring clients pass the current production-readiness checks.</div>'}${badProfiles.length?`<div class="billing-profile-alert-v59694"><strong>Billing Profile confirmation required</strong>${badProfiles.map(({p,issues})=>`<span>${esc94(p.displayName||p.legalName||'Billing Profile')}: ${esc94(issues.join(', '))}</span>`).join('')}</div>`:''}`;
}
function recurrenceDialog94(){let d=$('recurrenceConfirmDialogV59694');if(d)return d;d=document.createElement('dialog');d.id='recurrenceConfirmDialogV59694';d.className='dialog recurrence-confirm-dialog-v59694';document.body.appendChild(d);return d;}
window.openRecurrenceConfirmationV59694=function(id){
  const client=clientById94(id);if(!client)return;
  if(!regularRecurring94(client)){toast94('Custom recurrence must be defined manually; it cannot be auto-activated from a guessed rule.','error');return;}
  const last=latestClientJob94(client),anchor=validDate(client.recurrenceAnchorDate||client.serviceStartDate)?String(client.recurrenceAnchorDate||client.serviceStartDate):validDate(last?.date)?last.date:'',proposedDay=validDate(last?.date)?weekday(last.date):validDate(anchor)?weekday(anchor):safeText(client.preferredDay),proposedTeam=last?.teamId||client.preferredTeamId||client.teamId||'',agreements=agreementRows94(client),d=recurrenceDialog94();
  d.innerHTML=`<form class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Confirm recurring commitment</span><h2>${esc94(client.name||'Client')}</h2><p>Use the real diary/route as evidence. Nothing is guessed.</p></div><button type="button" class="icon-button" data-close>×</button></div><div class="recurrence-evidence-v59694"><span>Frequency <b>${esc94(client.frequency||'—')}</b></span><span>Last scheduled visit <b>${esc94(last?`${fmtDate94(last.date)} · ${teamById94(last.teamId)?.name||'No team'}`:'None')}</b></span><span>Services <b>${explicitServices94(client).length}</b></span><span>Rate <b>R ${rate94(client).toFixed(2)}</b></span></div><div class="form-grid two"><label>Confirmed recurring day *<select id="recurrenceDayV59694">${DAYS.slice(1,7).map(day=>`<option value="${day}">${day}</option>`).join('')}</select></label><label>Confirmed team *<select id="recurrenceTeamV59694"><option value="">Choose team</option>${activeTeams94().map(team=>`<option value="${esc94(team.id)}">${esc94(team.name)}</option>`).join('')}</select></label><label>Recurrence anchor *<input id="recurrenceAnchorV59694" type="date" required value="${esc94(anchor)}"></label><label>Service agreement<span class="read-only-value-v59694">${agreements.length===1?esc94(String(agreements[0].status||'Draft')):`${agreements.length} agreements — review required`}</span></label></div><div id="recurrenceErrorV59694" class="backend-gate-error"></div><div class="persistent-inline-note">Confirming this changes the client from diary-managed onboarding to live recurring scheduling and activates the single service agreement. Existing historical jobs are not replaced.</div><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">Confirm &amp; activate recurrence</button></div></form>`;
  d.querySelector('#recurrenceDayV59694').value=DAYS.includes(proposedDay)&&proposedDay!=='Sunday'?proposedDay:'Monday';d.querySelector('#recurrenceTeamV59694').value=proposedTeam||'';d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('form').onsubmit=event=>{event.preventDefault();const day=d.querySelector('#recurrenceDayV59694').value,teamId=d.querySelector('#recurrenceTeamV59694').value,newAnchor=d.querySelector('#recurrenceAnchorV59694').value,error=$('recurrenceErrorV59694'),readiness=clientReadiness94(client),preBlock=readiness.blockers.filter(x=>!['confirmed recurring day','recurrence anchor','recurring day does not match anchor','confirmed team','active service agreement','automatic recurrence not activated','no future recurring visit'].includes(x));if(preBlock.length){error.textContent=`Complete the client first: ${preBlock.join(', ')}.`;return;}if(!validDate(newAnchor)||weekday(newAnchor)!==day){error.textContent=`The anchor date is ${weekday(newAnchor)||'invalid'}, not ${day}. Choose a matching anchor/day.`;return;}if(!teamById94(teamId)){error.textContent='Choose an active team.';return;}if(agreements.length!==1||!(agreements[0].lines||[]).length){error.textContent='This client must have exactly one reviewed service agreement with included service lines before recurrence can be activated.';return;}client.preferredDay=day;client.preferredTeamId=teamId;client.teamId=teamId;client.recurrenceAnchorDate=newAnchor;client.serviceStartDate=client.serviceStartDate||newAnchor;client.autoScheduleEnabled=true;client.scheduleSource='confirmed-recurring';client.schedulingPolicyV58951='confirmed-recurring';client.onboardingStatusV59694='live';client.onboardingConfirmedAtV59694=new Date().toISOString();const agreement=agreements[0];agreement.status='Active';agreement.preferredDays=[day];agreement.defaultTeamId=teamId;agreement.startDate=agreement.startDate||newAnchor;agreement.updatedAt=new Date().toISOString();agreement.source='confirmed-by-office-v59694';safeSave94();try{window.scheduleRollingRefreshV58929?.('confirmed-recurring-v59694',80);}catch(error94){console.warn(error94);}d.close();window.renderClients?.();window.renderSchedule?.();toast94(`${client.name} recurrence activated. Future visits are being refreshed.`);};
  d.showModal();
};

/* -----------------------------------------------------------------------
   4) Day instructions + ad hoc team events.
   These are non-client calendar items. Multiple instructions may exist for the
   same team/day. Instructions render before events, and both render before jobs.
   ----------------------------------------------------------------------- */
let actions94=[],actionsBusiness94='',actionsLoadedAt94=0,actionsBusy94=false,actionRetryTimer94=0,actionRetryCount94=0;
function rawActionKind94(row){return safeText(row?.payload?.kindV59694||row?.kindV59694||row?.kind||'');}
function actionKind94(row){
  const explicit=rawActionKind94(row);if(['team_note','internal_event'].includes(explicit))return explicit;
  const assignedType=safeText(row?.assigned_type||row?.assignedType||row?.payload?.assignedType||'');
  const calendarDate=safeText(row?.calendar_date||row?.calendarDate||row?.payload?.calendarDate||'').slice(0,10);
  if(assignedType==='team'&&validDate(calendarDate)){
    const title=safeText(row?.title||row?.payload?.title||'');
    return /day instruction|team note|instruction/i.test(title)?'team_note':'internal_event';
  }
  return '';
}
function normaliseAction94(row){const p=row?.payload||{};return {...p,id:String(row?.id||p.id||''),title:safeText(row?.title||p.title),detail:safeText(row?.detail||p.detail),status:safeText(row?.status||p.status||'scheduled'),assignedType:safeText(row?.assigned_type||p.assignedType||'team'),assignedId:safeText(row?.assigned_id||p.assignedId),calendarDate:safeText(row?.calendar_date||p.calendarDate).slice(0,10),calendarTime:safeText(row?.calendar_time||p.calendarTime).slice(0,5),payload:p,kindV59694:safeText(p.kindV59694||row?.kindV59694||row?.kind)};}
async function loadActions94(force=false){const b=window.backendV28;if(!b?.client||!b?.businessId||b.mode!=='supabase')return false;if(actionsBusy94)return false;const now=Date.now();if(!force&&actionsBusiness94===b.businessId&&now-actionsLoadedAt94<15000){injectScheduleItems94();injectMobileItems94();return true;}actionsBusy94=true;try{const {data,error}=await b.client.from('operational_actions_v59674').select('*').eq('business_id',b.businessId).order('calendar_date',{ascending:true});if(error)throw error;actions94=(data||[]).map(normaliseAction94).filter(a=>a.assignedType==='team'&&validDate(a.calendarDate)&&['team_note','internal_event'].includes(actionKind94(a)));actionsBusiness94=b.businessId;actionsLoadedAt94=now;injectScheduleItems94();injectMobileItems94();return true;}catch(error){console.warn('[TuinBooks 59.6.97] day instruction/event load',error);return false;}finally{actionsBusy94=false;}}
function ensureActionLoad94(force=false){clearTimeout(actionRetryTimer94);const b=window.backendV28;if(b?.client&&b?.businessId&&b.mode==='supabase'){actionRetryCount94=0;return loadActions94(force);}if(actionRetryCount94<20){actionRetryCount94+=1;actionRetryTimer94=setTimeout(()=>ensureActionLoad94(force),700);}return Promise.resolve(false);}
function actionPayload94(action){return {...action,payload:{...(action.payload||{}),kindV59694:action.kindV59694,createdByFeature:'schedule-day-instructions-events-v59697'},kindV59694:action.kindV59694};}
async function persistAction94(action){const b=window.backendV28;if(!b?.client||!b?.businessId||b.mode!=='supabase')throw new Error('Open the live TuinBooks workspace before saving this calendar item.');const row=actionPayload94(action);let result=await b.client.rpc('tuinbooks_save_operational_action_v59674',{p_business_id:b.businessId,p_row:row});if(result.error){const message=String(result.error.message||result.error);if(/function|rpc|schema cache|not found/i.test(message)){const direct={id:row.id,business_id:b.businessId,title:row.title,detail:row.detail,status:row.status||'scheduled',priority:'normal',assigned_type:'team',assigned_id:row.assignedId||'',calendar_date:row.calendarDate,calendar_time:row.calendarTime||null,payload:row.payload};result=await b.client.from('operational_actions_v59674').upsert(direct,{onConflict:'id'}).select('*').single();}if(result.error)throw result.error;}await loadActions94(true);return result.data;}
function actionSort94(a,b){const ak=actionKind94(a)==='team_note'?0:1,bk=actionKind94(b)==='team_note'?0:1;if(ak!==bk)return ak-bk;const at=a.calendarTime||'00:00',bt=b.calendarTime||'00:00';if(at!==bt)return at.localeCompare(bt);return String(a.title||a.detail||'').localeCompare(String(b.title||b.detail||''));}
function scheduleItemsFor94(teamId,date){return actions94.filter(a=>a.status!=='cancelled'&&String(a.assignedId)===String(teamId)&&a.calendarDate===date).sort(actionSort94);}
function itemHtml94(a){const note=actionKind94(a)==='team_note',primary=note?(a.detail||a.title||'Day instruction'):(a.title||'Ad hoc event'),secondary=note?'':a.detail;return `<button type="button" class="schedule-operational-item-v59694 ${note?'note':'event'}" onclick="event.stopPropagation();openOperationalItemV59694('${esc94(a.id)}')"><span>${note?'DAY INSTRUCTION':'AD HOC EVENT'}</span><div><strong>${esc94(primary)}</strong>${secondary?`<small>${esc94(secondary)}</small>`:''}</div>${a.calendarTime?`<time>${esc94(a.calendarTime)}</time>`:''}</button>`;}
function injectScheduleItems94(){document.querySelectorAll('.schedule-day-lane[data-team-id][data-date]').forEach(lane=>{const teamId=lane.dataset.teamId,date=lane.dataset.date,rows=scheduleItemsFor94(teamId,date),old=lane.querySelector(':scope > .schedule-operational-items-v59694');if(!rows.length){old?.remove();return;}const html=`<div class="schedule-operational-items-v59694">${rows.map(itemHtml94).join('')}</div>`;if(old)old.outerHTML=html;else{const cards=lane.querySelector('.schedule-lane-cards');cards?.insertAdjacentHTML('beforebegin',html);}});}
function mobileTeam94(){return $('mobileTeamSelect')?.value||'';}
function injectMobileItems94(){const host=$('mobileScheduleList');if(!host)return;const teamId=mobileTeam94();if(!teamId)return;const rows=scheduleItemsFor94(teamId,localISO()),signature=rows.map(a=>`${a.id}|${a.status}|${a.calendarTime}|${a.title}|${a.detail}`).join('~'),existing=host.querySelector(':scope > .mobile-operational-items-v59694');if(existing?.dataset.signature===signature)return;existing?.remove();if(rows.length){const section=document.createElement('section');section.className='mobile-operational-items-v59694';section.dataset.signature=signature;section.innerHTML=rows.map(a=>{const note=actionKind94(a)==='team_note',primary=note?(a.detail||a.title||'Day instruction'):(a.title||'Ad hoc event');return `<article class="mobile-operational-item-v59694 ${note?'note':'event'}"><span>${note?'DAY INSTRUCTION':'AD HOC EVENT'}</span><strong>${esc94(primary)}</strong>${!note&&a.detail?`<p>${esc94(a.detail)}</p>`:''}${a.calendarTime?`<time>${esc94(a.calendarTime)}</time>`:''}</article>`;}).join('');host.prepend(section);}}
function installScheduleActions94(){const view=$('view-schedule');if(!view)return;let wrap=$('scheduleOperationalToolbarV59697');if(!wrap){wrap=document.createElement('section');wrap.id='scheduleOperationalToolbarV59697';wrap.className='schedule-operational-toolbar-v59697';wrap.innerHTML='<div><span class="eyebrow">Team-day items</span><strong>Instructions &amp; ad hoc events</strong><small>Day instructions appear first on the team route. Ad hoc events are not linked to a client or invoice.</small></div><div class="schedule-note-actions-v59694"><button type="button" class="button secondary" id="newTeamNoteV59694">+ Day instruction</button><button type="button" class="button secondary" id="newInternalEventV59694">+ Ad hoc event</button></div>';const anchor=$('rollingScheduleOverview')||view.firstElementChild;anchor?view.insertBefore(wrap,anchor):view.prepend(wrap);$('newTeamNoteV59694').onclick=()=>openOperationalEditor94('team_note');$('newInternalEventV59694').onclick=()=>openOperationalEditor94('internal_event');}}
function operationalDialog94(){let d=$('operationalItemDialogV59694');if(d)return d;d=document.createElement('dialog');d.id='operationalItemDialogV59694';d.className='dialog operational-item-dialog-v59694';document.body.appendChild(d);return d;}
function openOperationalEditor94(kind,existing=null){const note=kind==='team_note',d=operationalDialog94(),date=existing?.calendarDate||localISO(),teamId=existing?.assignedId||activeTeams94()[0]?.id||'';d.innerHTML=`<form class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">${note?'Shown before the first job':'Non-client calendar item'}</span><h2>${existing?'Edit ': 'New '}${note?'day instruction':'ad hoc event'}</h2></div><button type="button" class="icon-button" data-close>×</button></div><div class="form-grid two"><label>Date *<input id="opDateV59694" type="date" required value="${esc94(date)}"></label><label>Team *<select id="opTeamV59694" required>${activeTeams94().map(team=>`<option value="${esc94(team.id)}">${esc94(team.name)}</option>`).join('')}</select></label>${note?'':`<label>Time, optional<input id="opTimeV59694" type="time" value="${esc94(existing?.calendarTime||'')}"></label><label>Event title *<input id="opTitleV59694" required maxlength="100" value="${esc94(existing?.title||'')}"></label>`}<label class="span-two">${note?'Instruction *':'Details'}<textarea id="opDetailV59694" rows="4" ${note?'required':''} placeholder="${note?'e.g. Take the long ladder and extra refuse bags':''}">${esc94(existing?.detail||'')}</textarea></label></div><div id="opErrorV59694" class="backend-gate-error"></div><div class="dialog-actions">${existing?'<button type="button" class="button danger secondary" data-delete>Remove</button>':''}<button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">Save</button></div></form>`;d.querySelector('#opTeamV59694').value=teamId;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.querySelector('[data-delete]')?.addEventListener('click',async()=>{existing.status='cancelled';try{await persistAction94(existing);d.close();window.renderSchedule?.();injectScheduleItems94();toast94(note?'Day instruction removed.':'Ad hoc event removed.');}catch(error){$('opErrorV59694').textContent=String(error.message||error);}});d.querySelector('form').onsubmit=async event=>{event.preventDefault();const detail=d.querySelector('#opDetailV59694').value.trim(),title=note?'Day instruction':d.querySelector('#opTitleV59694').value.trim();if(note&&!detail)return;const action=existing||{id:typeof window.uid==='function'?window.uid('action'):crypto.randomUUID(),createdAt:new Date().toISOString()};Object.assign(action,{kindV59694:kind,title,detail,status:'scheduled',assignedType:'team',assignedId:d.querySelector('#opTeamV59694').value,calendarDate:d.querySelector('#opDateV59694').value,calendarTime:note?'':d.querySelector('#opTimeV59694').value,payload:{...(action.payload||{}),kindV59694:kind}});try{await persistAction94(action);d.close();window.renderSchedule?.();injectScheduleItems94();toast94(note?'Day instruction saved.':'Ad hoc event saved.');}catch(error){$('opErrorV59694').textContent=String(error.message||error);}};d.showModal();}
window.openOperationalItemV59694=function(id){const a=actions94.find(row=>String(row.id)===String(id));if(a)openOperationalEditor94(actionKind94(a)||'internal_event',a);};

/* -----------------------------------------------------------------------
   5) Quote Management-mode clarity. Sending policy remains unchanged.
   ----------------------------------------------------------------------- */
function renderQuoteSupportNotice94(){const view=$('view-quotes');if(!view)return;let note=$('quoteSupportModeNoticeV59694');const management=Boolean(window.backendV28?.supportContext?.business_id),allowed=typeof window.outboundCommunicationsAllowedV5960==='function'?window.outboundCommunicationsAllowedV5960():true;if(!management||allowed){note?.remove();return;}if(!note){note=document.createElement('section');note.id='quoteSupportModeNoticeV59694';note.className='panel quote-support-notice-v59694';view.querySelector('.page-subtabs')?.insertAdjacentElement('afterend',note);}note.innerHTML='<div><span class="eyebrow">Management support mode</span><strong>Quote sending is intentionally disabled here</strong><p>You can create, edit and Preview the quote. Email/WhatsApp sending must be tested from the client’s normal daily login, so a support session cannot accidentally contact a real customer.</p></div><span class="status-badge review">Sending locked</span>';}

/* -----------------------------------------------------------------------
   6) Billing Profile readiness summary. No profile data is guessed.
   ----------------------------------------------------------------------- */
function renderBillingProfileReadiness94(){const settings=$('billingProfilesSettingsV59396'),list=$('billingProfilesListV59396');if(!settings||!list)return;let panel=$('billingProfileReadinessV59694');if(!panel){panel=document.createElement('div');panel.id='billingProfileReadinessV59694';panel.className='billing-profile-readiness-v59694';list.before(panel);}const profiles=(window.state?.billingProfilesV59396||[]).filter(p=>p.isActive!==false);panel.innerHTML=profiles.map(p=>{const issues=profileIssues94(p);return `<article class="${issues.length?'needs':'ready'}"><div><strong>${esc94(p.displayName||p.legalName||'Billing Profile')}</strong><small>${issues.length?esc94(issues.join(' · ')):'Core issuing details present'}</small></div><span>${issues.length?'Needs confirmation':'Ready'}</span></article>`;}).join('')||'<div class="ui-empty compact">No Billing Profiles loaded.</div>';}

/* -----------------------------------------------------------------------
   Runtime wrappers. Keep existing v59.6.93 behaviour as the base.
   ----------------------------------------------------------------------- */
function wrapRenderer94(name,after){const current=window[name];if(typeof current!=='function'||current.__v59694)return;const wrapped=function(...args){const result=current.apply(this,args);try{after();}catch(error){console.warn(`[TuinBooks 59.6.94] ${name} enhancement`,error);}return result;};wrapped.__v59694=true;window[name]=wrapped;}
function install94(){
  const app=document.body?.dataset?.app||'';
  if(app==='desktop'){
    wrapRenderer94('renderRecords',renderWorkTeamHistory94);
    wrapRenderer94('renderClients',renderOnboardingReadiness94);
    wrapRenderer94('renderSchedule',()=>{installScheduleActions94();injectScheduleItems94();ensureActionLoad94();});
    wrapRenderer94('renderQuotes',renderQuoteSupportNotice94);
    wrapRenderer94('renderSettings',renderBillingProfileReadiness94);
    installScheduleActions94();
    const marker=$('tuinbooksBuildV59697')||$('tuinbooksBuildV59696')||$('tuinbooksBuildV59676')||$('tuinbooksBuildV59674')||$('tuinbooksBuildV59673');
    if(marker){marker.id='tuinbooksBuildV59698';marker.textContent='v59.6.98';marker.title='TuinBooks Work page single Today layout + schedule day instructions';}
    if(window.activeView==='records')renderWorkTeamHistory94();
    if(window.activeView==='clients')renderOnboardingReadiness94();
    if(window.activeView==='quotes')renderQuoteSupportNotice94();
    if(window.activeView==='settings')renderBillingProfileReadiness94();
    injectScheduleItems94();
    document.addEventListener('change',event=>{if(event.target?.id==='recordsMonth'||event.target?.id==='recordTeamFilter')setTimeout(renderWorkTeamHistory94,0);});
  }
  if(app==='mobile'){
    const mobileHost=$('mobileScheduleList');
    if(mobileHost&&!mobileHost.__v59697Observer){
      let busy=false;
      const observer=new MutationObserver(()=>{if(busy)return;busy=true;queueMicrotask(async()=>{await ensureActionLoad94();injectMobileItems94();busy=false;});});
      observer.observe(mobileHost,{childList:true,subtree:false});
      mobileHost.__v59697Observer=observer;
    }
    $('mobileTeamSelect')?.addEventListener('change',()=>setTimeout(async()=>{await ensureActionLoad94();injectMobileItems94();},0));
  }
  ensureActionLoad94(true);
  window.addEventListener('focus',()=>ensureActionLoad94(),{passive:true});
  window.addEventListener('online',()=>ensureActionLoad94(true),{passive:true});
  window.__tuinbooksStabilityRepairV59694=BUILD;window.__tuinbooksBuild=BUILD;
}
if(window.__TUINBOOKS_APP_RUNTIME_READY__)install94();else window.addEventListener('tuinbooks:runtime-ready',install94,{once:true});
setTimeout(()=>{if(!window.__tuinbooksStabilityRepairV59694&&window.__TUINBOOKS_APP_RUNTIME_READY__)install94();},500);
})();
