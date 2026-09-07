/* TuinBooks v59.6.74 — operational control
   Active recurring schedule health + Needs Attention + Actions + Work Orders.
   Completes v59.6.72 team-note/internal-event persistence through the companion SQL migration.
*/
(()=>{
'use strict';
const BUILD='59.6.74-operational-control';
if(window.__tuinbooksOperationalControlBuild===BUILD)return;

state.operationalActionsV59674=Array.isArray(state.operationalActionsV59674)?state.operationalActionsV59674:[];
state.workOrdersV59674=Array.isArray(state.workOrdersV59674)?state.workOrdersV59674:[];
let operationalLoadBusyV59674=false;
let operationalFilterV59674='all';

const opEscV59674=value=>typeof esc==='function'?esc(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opTodayV59674=()=>typeof localDateISO==='function'?localDateISO():new Date().toISOString().slice(0,10);
const opDateAddV59674=(date,days)=>typeof dateAdd==='function'?dateAdd(date,days):(()=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);})();
const opIdV59674=prefix=>typeof uid==='function'?uid(prefix):`${prefix}-${crypto.randomUUID()}`;
const opProfileV59674=()=>typeof accessProfileV59671==='function'?accessProfileV59671():String(backendV28?.role||'').toLowerCase();
const opCanEditV59674=()=>['owner','admin','scheduler','support'].includes(opProfileV59674())||Boolean(backendV28?.supportContext);
const opClientV59674=id=>typeof clientById==='function'?clientById(id):(state.clients||[]).find(row=>String(row.id)===String(id));
const opTeamV59674=id=>typeof teamById==='function'?teamById(id):(state.teams||[]).find(row=>String(row.id)===String(id));
const opQuoteV59674=id=>typeof quoteById==='function'?quoteById(id):(state.quotes||[]).find(row=>String(row.id)===String(id));
const opFmtDateV59674=date=>date?(typeof fmtDate==='function'?fmtDate(date):new Date(`${date}T12:00:00`).toLocaleDateString('en-ZA')):'—';
const opFmtTimeV59674=time=>String(time||'').slice(0,5)||'';
const opMoneyV59674=value=>typeof money==='function'?money(Number(value||0)):`R ${Number(value||0).toFixed(2)}`;

function opRecurringClientV59674(client){
  if(!client)return false;
  if(typeof businessRecurringClientV59410==='function')return businessRecurringClientV59410(client);
  return !['quote-contact','once-off-customer'].includes(client.recordKindV58951)&&String(client.frequency||'').toLowerCase()!=='ad hoc'&&client.serviceState!=='once-off';
}
function opActiveRecurringClientV59674(client){
  return opRecurringClientV59674(client)&&String(client.status||'active').toLowerCase()==='active'&&!['paused','archived','cancelled','once-off'].includes(String(client.serviceState||'').toLowerCase());
}
function opFutureJobsV59674(clientId){
  const today=opTodayV59674();
  return (state.schedules||[]).filter(job=>String(job.clientId||'')===String(clientId)&&String(job.date||'').slice(0,10)>=today&&!['cancelled','deleted','archived','rescheduled','deferred','missed'].includes(String(job.status||'').toLowerCase())).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function opLastCompletedV59674(clientId){
  return (state.visits||[]).filter(v=>String(v.clientId||'')===String(clientId)&&String(v.outcome||'Completed').toLowerCase()==='completed').sort((a,b)=>String(b.date||b.workDate||'').localeCompare(String(a.date||a.workDate||'')))[0]||null;
}
function scheduleHealthV59674(client){
  if(!opActiveRecurringClientV59674(client))return {key:'inactive',label:'Paused / non-recurring',tone:'neutral',jobs:[]};
  const jobs=opFutureJobsV59674(client.id),next=jobs[0]||null,last=jobs.at(-1)||null;
  if(!next)return {key:'unscheduled',label:'NOT SCHEDULED',tone:'danger',jobs:[],next:null,last:null};
  const threshold=opDateAddV59674(opTodayV59674(),30);
  if(String(last.date||'')<threshold)return {key:'ending',label:'Schedule ending soon',tone:'warn',jobs,next,last};
  return {key:'scheduled',label:'Scheduled',tone:'good',jobs,next,last};
}
function unscheduledRecurringV59674(){return (state.clients||[]).filter(c=>scheduleHealthV59674(c).key==='unscheduled');}
function endingRecurringV59674(){return (state.clients||[]).filter(c=>scheduleHealthV59674(c).key==='ending');}
function missedUnresolvedV59674(){
  return (state.schedules||[]).filter(job=>typeof scheduleJobNeedsOfficeActionV58928==='function'?scheduleJobNeedsOfficeActionV58928(job):['missed','attention','access-failed'].includes(String(job.status||'').toLowerCase())&&!job.resolution);
}
function actionOverdueV59674(action){return ['open','scheduled'].includes(String(action.status||''))&&action.dueDate&&String(action.dueDate)<opTodayV59674();}
function openActionsV59674(){return (state.operationalActionsV59674||[]).filter(a=>!['completed','cancelled'].includes(String(a.status||'')));}
function awaitingWorkOrdersV59674(){return (state.workOrdersV59674||[]).filter(w=>String(w.status||'')==='awaiting_scheduling');}
function workOrderForSourceV59674(type,id){return (state.workOrdersV59674||[]).find(w=>w.sourceType===type&&String(w.sourceId||'')===String(id||'')&&w.status!=='cancelled')||null;}

function quoteAcceptedV59674(quote){
  if(!quote)return false;
  if(typeof quoteIsAcceptedV5894==='function'&&quoteIsAcceptedV5894(quote))return true;
  return ['accepted','approved','scheduled','converted'].includes(String(quote.status||'').toLowerCase())||Boolean(quote.acceptedAt||quote.approvedAt);
}
function quoteIsServiceV59674(quote){return String(quote?.quoteTypeV58940||quote?.quoteType||'service').toLowerCase()!=='stock';}
function quoteNeedsWorkV59674(quote){return quoteAcceptedV59674(quote)&&quoteIsServiceV59674(quote)&&!(typeof quotePaymentOutstandingV58940==='function'&&quotePaymentOutstandingV58940(quote));}
function quoteJobsV59674(quote){return (state.schedules||[]).filter(j=>String(j.quoteId||'')===String(quote.id)||String(j.workOrderSourceQuoteIdV59674||'')===String(quote.id));}
function acceptedQuotesAwaitingV59674(){return (state.quotes||[]).filter(q=>quoteNeedsWorkV59674(q)&&!workOrderForSourceV59674('quote',q.id)&&!quoteJobsV59674(q).length);}

function normaliseActionV59674(row){
  const p=row?.payload||{};
  return {...p,id:String(row?.id||p.id||''),title:String(row?.title||p.title||''),detail:String(row?.detail||p.detail||''),status:String(row?.status||p.status||'open'),priority:String(row?.priority||p.priority||'normal'),dueDate:String(row?.due_date||p.dueDate||'').slice(0,10),dueTime:opFmtTimeV59674(row?.due_time||p.dueTime),assignedType:String(row?.assigned_type||p.assignedType||'office'),assignedId:String(row?.assigned_id||p.assignedId||''),linkedType:String(row?.linked_type||p.linkedType||''),linkedId:String(row?.linked_id||p.linkedId||''),calendarDate:String(row?.calendar_date||p.calendarDate||'').slice(0,10),calendarTime:opFmtTimeV59674(row?.calendar_time||p.calendarTime),completedAt:row?.completed_at||p.completedAt||'',cancelledAt:row?.cancelled_at||p.cancelledAt||'',createdAt:row?.created_at||p.createdAt||''};
}
function normaliseWorkOrderV59674(row){
  const p=row?.payload||{};
  return {...p,id:String(row?.id||p.id||''),clientId:String(row?.client_id||p.clientId||''),siteText:String(row?.site_text||p.siteText||''),title:String(row?.title||p.title||''),detail:String(row?.detail||p.detail||''),sourceType:String(row?.source_type||p.sourceType||'manual'),sourceId:String(row?.source_id||p.sourceId||''),quotedValue:row?.quoted_value??p.quotedValue??'',estimatedMinutes:row?.estimated_minutes??p.estimatedMinutes??'',requirements:String(row?.requirements||p.requirements||''),preferredDate:String(row?.preferred_date||p.preferredDate||'').slice(0,10),dueDate:String(row?.due_date||p.dueDate||'').slice(0,10),status:String(row?.status||p.status||'awaiting_scheduling'),scheduledJobId:String(row?.scheduled_job_id||p.scheduledJobId||''),scheduledDate:String(row?.scheduled_date||p.scheduledDate||'').slice(0,10),scheduledTeamId:String(row?.scheduled_team_id||p.scheduledTeamId||''),workRecordId:String(row?.work_record_id||p.workRecordId||''),completedAt:row?.completed_at||p.completedAt||'',createdAt:row?.created_at||p.createdAt||''};
}
async function loadOperationalControlV59674({force=false}={}){
  if(operationalLoadBusyV59674)return;
  if(backendV28?.mode!=='supabase'||!backendV28.client||!backendV28.businessId){renderOperationalControlV59674();return;}
  operationalLoadBusyV59674=true;
  try{
    const [actions,orders]=await Promise.all([
      backendV28.client.from('operational_actions_v59674').select('*').eq('business_id',backendV28.businessId).order('created_at',{ascending:false}),
      backendV28.client.from('work_orders_v59674').select('*').eq('business_id',backendV28.businessId).order('created_at',{ascending:false})
    ]);
    if(actions.error)throw actions.error;if(orders.error)throw orders.error;
    state.operationalActionsV59674=(actions.data||[]).map(normaliseActionV59674);
    state.workOrdersV59674=(orders.data||[]).map(normaliseWorkOrderV59674);
    await reconcileWorkOrdersV59674();
    await ensureAcceptedQuoteWorkOrdersV59674();
  }catch(error){console.warn('Operational control load',error);}
  finally{operationalLoadBusyV59674=false;renderOperationalControlV59674();}
}
async function persistActionV59674(action){
  action.updatedAt=new Date().toISOString();
  if(backendV28?.mode==='supabase'&&backendV28.client&&backendV28.businessId){
    const {data,error}=await backendV28.client.rpc('tuinbooks_save_operational_action_v59674',{p_business_id:backendV28.businessId,p_row:action});
    if(error)throw error;if(!action.id)action.id=String(data||'');
  }else{try{save?.();}catch(_){}}
  const i=(state.operationalActionsV59674||[]).findIndex(a=>a.id===action.id);if(i<0)state.operationalActionsV59674.unshift(action);else state.operationalActionsV59674[i]=action;
  renderOperationalControlV59674();return action;
}
async function persistWorkOrderV59674(order){
  order.updatedAt=new Date().toISOString();
  if(backendV28?.mode==='supabase'&&backendV28.client&&backendV28.businessId){
    const {data,error}=await backendV28.client.rpc('tuinbooks_save_work_order_v59674',{p_business_id:backendV28.businessId,p_row:order});
    if(error)throw error;if(!order.id)order.id=String(data||'');
  }else{try{save?.();}catch(_){}}
  const i=(state.workOrdersV59674||[]).findIndex(w=>w.id===order.id);if(i<0)state.workOrdersV59674.unshift(order);else state.workOrdersV59674[i]=order;
  renderOperationalControlV59674();return order;
}
async function ensureAcceptedQuoteWorkOrdersV59674(){
  if(!opCanEditV59674())return;
  for(const quote of (state.quotes||[]).filter(quoteNeedsWorkV59674)){
    if(workOrderForSourceV59674('quote',quote.id))continue;
    const jobs=quoteJobsV59674(quote),job=jobs.find(j=>!['cancelled','deleted'].includes(String(j.status||'').toLowerCase()))||null;
    const client=opClientV59674(quote.clientId)||{};
    const descriptions=(quote.lineItems||[]).map(line=>line.description).filter(Boolean);
    const order={id:opIdV59674('wo'),clientId:quote.clientId,siteText:client.address||'',title:descriptions[0]||`Work from ${quote.number||'accepted quote'}`,detail:descriptions.join('; '),sourceType:'quote',sourceId:quote.id,quotedValue:typeof quoteTotal==='function'?quoteTotal(quote):'',estimatedMinutes:Math.round(Number(quote.estimatedHours||quote.durationHours||client.estimatedHours||1)*60),requirements:'',preferredDate:'',dueDate:'',status:job?'scheduled':'awaiting_scheduling',scheduledJobId:job?.id||'',scheduledDate:job?.date||'',scheduledTeamId:job?.teamId||'',workRecordId:'',createdAt:new Date().toISOString()};
    state.workOrdersV59674.unshift(order);
    try{await persistWorkOrderV59674(order);}catch(error){console.warn('Accepted quote work order',error);}
  }
}
async function reconcileWorkOrdersV59674(){
  if(!opCanEditV59674())return;
  for(const order of state.workOrdersV59674||[]){
    let job=order.scheduledJobId?(state.schedules||[]).find(j=>String(j.id)===String(order.scheduledJobId)):null;
    if(!job&&order.sourceType==='quote')job=(state.schedules||[]).find(j=>String(j.quoteId||'')===String(order.sourceId));
    const visit=job?(state.visits||[]).find(v=>String(v.scheduledJobId||'')===String(job.id)):null;
    let changed=false;
    if(job&&!order.scheduledJobId){order.scheduledJobId=job.id;order.scheduledDate=job.date||'';order.scheduledTeamId=job.teamId||'';order.status=String(job.status||'').toLowerCase()==='completed'?'completed':'scheduled';changed=true;}
    if(visit&&String(visit.outcome||'').toLowerCase()==='completed'&&(order.status!=='completed'||order.workRecordId!==visit.id)){order.status='completed';order.workRecordId=visit.id;order.completedAt=visit.completedAt||visit.updatedAt||new Date().toISOString();changed=true;}
    if(changed)try{await persistWorkOrderV59674(order);}catch(error){console.warn('Work Order reconciliation',error);}
  }
}

function ensureOperationalBarV59674(){
  if(document.body.dataset.app!=='desktop')return null;
  let bar=document.getElementById('operationalControlBarV59674');
  if(bar)return bar;
  bar=document.createElement('section');bar.id='operationalControlBarV59674';bar.className='operational-control-bar-v59674';
  const main=document.querySelector('.admin-main'),toast=document.getElementById('appToast');if(!main)return null;
  toast?.insertAdjacentElement('afterend',bar);return bar;
}
function renderOperationalControlV59674(){
  if(document.body.dataset.app!=='desktop')return;
  const bar=ensureOperationalBarV59674();if(!bar)return;
  const unscheduled=unscheduledRecurringV59674().length,ending=endingRecurringV59674().length,missed=missedUnresolvedV59674().length,overdue=openActionsV59674().filter(actionOverdueV59674).length,open=openActionsV59674().length,orders=awaitingWorkOrdersV59674().length,accepted=acceptedQuotesAwaitingV59674().length,total=unscheduled+missed+overdue+orders+accepted;
  bar.innerHTML=`<div class="operational-control-copy-v59674"><span class="eyebrow">Operational control</span><strong>${total?`${total} item${total===1?'':'s'} need attention`:'Nothing critical is slipping through'}</strong></div><div class="operational-control-counts-v59674"><button class="${unscheduled?'danger':''}" onclick="openOperationalCentreV59674('unscheduled')"><b>${unscheduled}</b><span>Clients not scheduled</span></button>${ending?`<button class="warn" onclick="openOperationalCentreV59674('ending')"><b>${ending}</b><span>Schedules ending</span></button>`:''}<button class="${missed?'danger':''}" onclick="openOperationalCentreV59674('missed')"><b>${missed}</b><span>Missed visits</span></button><button class="${overdue?'danger':''}" onclick="openOperationalCentreV59674('actions')"><b>${open}</b><span>Open actions${overdue?` · ${overdue} overdue`:''}</span></button><button class="${orders?'warn':''}" onclick="openOperationalCentreV59674('orders')"><b>${orders}</b><span>Work to schedule</span></button></div>${opCanEditV59674()?`<div class="operational-control-actions-v59674"><button class="button secondary compact" onclick="openActionEditorV59674()">+ Action</button><button class="button secondary compact" onclick="openWorkOrderEditorV59674()">+ Work Order</button></div>`:''}`;
  decorateClientsScheduleHealthV59674();
}

function decorateClientsScheduleHealthV59674(){
  document.querySelectorAll('#clientList .client-row').forEach(row=>{
    const match=String(row.getAttribute('onclick')||'').match(/editClient\(['"]([^'"]+)/);if(!match)return;
    const client=opClientV59674(match[1]);if(!client||!opRecurringClientV59674(client))return;
    row.querySelector('.client-schedule-health-v59674')?.remove();
    const health=scheduleHealthV59674(client),meta=row.querySelector('.client-row-meta')||row;
    meta.insertAdjacentHTML('afterbegin',`<span class="client-schedule-health-v59674 ${health.tone}" title="${health.next?`Next ${opFmtDateV59674(health.next.date)}`:'No future booking'}">${opEscV59674(health.label)}</span>`);
  });
}
function renderClientSchedulePanelV59674(clientId){
  const form=document.getElementById('clientForm');if(!form)return;
  let panel=document.getElementById('clientScheduleHealthPanelV59674');if(!panel){panel=document.createElement('section');panel.id='clientScheduleHealthPanelV59674';panel.className='client-schedule-panel-v59674';form.querySelector('.form-actions')?.insertAdjacentElement('beforebegin',panel);}
  const client=opClientV59674(clientId);if(!client){panel.classList.add('hidden');return;}panel.classList.remove('hidden');
  const h=scheduleHealthV59674(client),last=opLastCompletedV59674(client.id),team=h.next?opTeamV59674(h.next.teamId):null;
  panel.innerHTML=`<div><span class="eyebrow">Schedule health</span><strong class="schedule-health-title-v59674 ${h.tone}">${opEscV59674(h.label)}</strong></div><div class="client-schedule-facts-v59674"><span><small>Frequency</small><b>${opEscV59674(client.frequency||'Not set')}</b></span><span><small>Next visit</small><b>${h.next?opFmtDateV59674(h.next.date):'None'}</b></span><span><small>Team</small><b>${opEscV59674(team?.name||'—')}</b></span><span><small>Scheduled through</small><b>${h.last?opFmtDateV59674(h.last.date):'None'}</b></span><span><small>Last completed</small><b>${last?opFmtDateV59674(last.date||last.workDate):'—'}</b></span></div><div class="client-schedule-panel-actions-v59674"><button type="button" class="button secondary compact" onclick="openClientScheduleV59674('${opEscV59674(client.id)}')">View schedule</button>${h.key==='unscheduled'?`<button type="button" class="button compact" onclick="openClientScheduleV59674('${opEscV59674(client.id)}',true)">Schedule client</button>`:''}<button type="button" class="button secondary compact" onclick="openActionEditorV59674('',{linkedType:'client',linkedId:'${opEscV59674(client.id)}'})">+ Action</button></div>`;
}
window.openClientScheduleV59674=function(clientId,openBasket=false){
  const client=opClientV59674(clientId);if(!client)return;
  if(typeof showView==='function')showView('schedule');
  if(document.getElementById('scheduleWeekPicker'))document.getElementById('scheduleWeekPicker').value=typeof startOfWeek==='function'?startOfWeek(opTodayV59674()):opTodayV59674();
  if(typeof scheduleQueueSearchV58930!=='undefined')try{scheduleQueueSearchV58930=client.name||client.address||'';}catch(_){ }
  try{renderSchedule?.();}catch(_){ }
  if(openBasket&&typeof openScheduleQueue==='function')setTimeout(()=>openScheduleQueue(),60);
};

function operationalDialogV59674(){
  let d=document.getElementById('operationalCentreDialogV59674');if(d)return d;
  d=document.createElement('dialog');d.id='operationalCentreDialogV59674';d.className='dialog operational-centre-dialog-v59674';d.innerHTML=`<div class="operational-centre-shell-v59674"><header><div><span class="eyebrow">Nothing falls through the cracks</span><h2>Needs Attention</h2></div><button class="icon-button" onclick="document.getElementById('operationalCentreDialogV59674').close()">×</button></header><nav id="operationalCentreTabsV59674"></nav><div id="operationalCentreBodyV59674" class="operational-centre-body-v59674"></div></div>`;document.body.appendChild(d);return d;
}
window.openOperationalCentreV59674=function(filter='all'){operationalFilterV59674=filter;renderOperationalCentreV59674();operationalDialogV59674().showModal();};
function renderOperationalCentreV59674(){
  const d=operationalDialogV59674(),tabs=d.querySelector('#operationalCentreTabsV59674'),body=d.querySelector('#operationalCentreBodyV59674');
  const counts={unscheduled:unscheduledRecurringV59674().length,ending:endingRecurringV59674().length,missed:missedUnresolvedV59674().length,actions:openActionsV59674().length,orders:awaitingWorkOrdersV59674().length};
  tabs.innerHTML=[['all','All'],['unscheduled','Unscheduled clients'],['ending','Ending schedules'],['missed','Missed work'],['actions','Actions'],['orders','Work Orders']].map(([key,label])=>`<button class="${operationalFilterV59674===key?'active':''}" onclick="setOperationalFilterV59674('${key}')">${label}${key!=='all'?` <b>${counts[key]||0}</b>`:''}</button>`).join('');
  const sections=[];
  if(['all','unscheduled'].includes(operationalFilterV59674))sections.push(operationalClientsHtmlV59674('unscheduled'));
  if(['all','ending'].includes(operationalFilterV59674))sections.push(operationalClientsHtmlV59674('ending'));
  if(['all','missed'].includes(operationalFilterV59674))sections.push(operationalMissedHtmlV59674());
  if(['all','actions'].includes(operationalFilterV59674))sections.push(operationalActionsHtmlV59674());
  if(['all','orders'].includes(operationalFilterV59674))sections.push(operationalOrdersHtmlV59674());
  body.innerHTML=sections.join('');
}
window.renderOperationalCentreV59674=renderOperationalCentreV59674;
window.setOperationalFilterV59674=function(key){operationalFilterV59674=key;renderOperationalCentreV59674();};
function operationalClientsHtmlV59674(key){
  const rows=key==='ending'?endingRecurringV59674():unscheduledRecurringV59674();
  return `<section class="operational-section-v59674"><div class="operational-section-head-v59674"><div><span class="eyebrow">Recurring schedule</span><h3>${key==='ending'?'Schedules ending soon':'Active clients not scheduled'}</h3></div><b>${rows.length}</b></div>${rows.length?rows.map(client=>{const h=scheduleHealthV59674(client);return `<article class="operational-row-v59674"><div><strong>${opEscV59674(client.name||client.address||'Unnamed client')}</strong><span>${opEscV59674(client.frequency||'Recurring')} · ${opEscV59674(client.suburb||client.address||'')}</span>${h.last?`<small>Scheduled through ${opFmtDateV59674(h.last.date)}</small>`:'<small>No future booking</small>'}</div><div><button class="button secondary compact" onclick="document.getElementById('operationalCentreDialogV59674').close();showView('clients');editClient('${opEscV59674(client.id)}')">Open client</button><button class="button compact" onclick="document.getElementById('operationalCentreDialogV59674').close();openClientScheduleV59674('${opEscV59674(client.id)}',true)">Schedule</button></div></article>`;}).join(''):'<div class="operational-empty-v59674">No clients in this exception.</div>'}</section>`;
}
function operationalMissedHtmlV59674(){
  const rows=missedUnresolvedV59674();return `<section class="operational-section-v59674"><div class="operational-section-head-v59674"><div><span class="eyebrow">Calendar exceptions</span><h3>Missed visits unresolved</h3></div><b>${rows.length}</b></div>${rows.length?rows.map(job=>{const client=opClientV59674(job.clientId)||{},team=opTeamV59674(job.teamId)||{};return `<article class="operational-row-v59674 danger-row"><div><strong>${opEscV59674(client.name||'Unknown client')}</strong><span>${opFmtDateV59674(job.date)} · ${opEscV59674(team.name||'No team')}</span></div><button class="button compact" onclick="document.getElementById('operationalCentreDialogV59674').close();showView('schedule');setTimeout(()=>{try{openMissingWorkRecordV19?.('${opEscV59674(job.id)}')}catch(_){renderSchedule?.()}},60)">Resolve</button></article>`;}).join(''):'<div class="operational-empty-v59674">No unresolved missed visits.</div>'}</section>`;
}
function actionLinkedLabelV59674(a){if(!a.linkedType||!a.linkedId)return 'Internal';if(a.linkedType==='client')return opClientV59674(a.linkedId)?.name||'Client';if(a.linkedType==='quote')return opQuoteV59674(a.linkedId)?.number||'Quote';return `${a.linkedType.replace('_',' ')} · ${a.linkedId}`;}
function operationalActionsHtmlV59674(){
  const rows=openActionsV59674().slice().sort((a,b)=>(actionOverdueV59674(b)-actionOverdueV59674(a))||String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  return `<section class="operational-section-v59674"><div class="operational-section-head-v59674"><div><span class="eyebrow">Persistent obligations</span><h3>Open Actions</h3></div><div><b>${rows.length}</b>${opCanEditV59674()?`<button class="button secondary compact" onclick="openActionEditorV59674()">+ Action</button>`:''}</div></div>${rows.length?rows.map(a=>`<article class="operational-row-v59674 ${actionOverdueV59674(a)?'danger-row':''}"><div><strong>${actionOverdueV59674(a)?'OVERDUE · ':''}${opEscV59674(a.title)}</strong><span>${opEscV59674(actionLinkedLabelV59674(a))}${a.dueDate?` · Due ${opFmtDateV59674(a.dueDate)}${a.dueTime?` ${opEscV59674(a.dueTime)}`:''}`:' · No due date'}</span>${a.calendarDate?`<small>Calendar: ${opFmtDateV59674(a.calendarDate)} ${opEscV59674(a.calendarTime||'')}</small>`:''}</div><div><button class="button secondary compact" onclick="openActionEditorV59674('${opEscV59674(a.id)}')">Open</button><button class="button compact" onclick="completeActionV59674('${opEscV59674(a.id)}')">Complete</button></div></article>`).join(''):'<div class="operational-empty-v59674">No open Actions.</div>'}</section>`;
}
function operationalOrdersHtmlV59674(){
  const rows=(state.workOrdersV59674||[]).filter(w=>!['completed','cancelled'].includes(w.status));return `<section class="operational-section-v59674"><div class="operational-section-head-v59674"><div><span class="eyebrow">Physical client work</span><h3>Work Orders</h3></div><div><b>${rows.length}</b>${opCanEditV59674()?`<button class="button secondary compact" onclick="openWorkOrderEditorV59674()">+ Work Order</button>`:''}</div></div>${rows.length?rows.map(w=>{const c=opClientV59674(w.clientId)||{};return `<article class="operational-row-v59674"><div><strong>${opEscV59674(w.title)}</strong><span>${opEscV59674(c.name||'Unknown client')} · ${opEscV59674(w.status.replaceAll('_',' '))}</span>${w.dueDate?`<small>Due ${opFmtDateV59674(w.dueDate)}</small>`:''}</div><div><button class="button secondary compact" onclick="openWorkOrderEditorV59674('${opEscV59674(w.id)}')">Open</button>${w.status==='awaiting_scheduling'?`<button class="button compact" onclick="scheduleWorkOrderV59674('${opEscV59674(w.id)}')">Schedule</button>`:''}</div></article>`;}).join(''):'<div class="operational-empty-v59674">No open Work Orders.</div>'}</section>`;
}

function actionDialogV59674(){let d=document.getElementById('actionEditorV59674');if(d)return d;d=document.createElement('dialog');d.id='actionEditorV59674';d.className='dialog operational-editor-dialog-v59674';document.body.appendChild(d);return d;}
window.openActionEditorV59674=function(id='',defaults={}){
  if(!opCanEditV59674())return toast('This profile cannot edit Actions.','error');
  const existing=(state.operationalActionsV59674||[]).find(a=>a.id===id)||null,a={priority:'normal',status:'open',assignedType:'office',...defaults,...existing};const d=actionDialogV59674();
  const clients=(state.clients||[]).map(c=>`<option value="${opEscV59674(c.id)}">${opEscV59674(c.name||c.address||c.id)}</option>`).join(''),teams=(state.teams||[]).filter(t=>t.active!==false).map(t=>`<option value="${opEscV59674(t.id)}">${opEscV59674(t.name)}</option>`).join('');
  d.innerHTML=`<form class="dialog-shell" id="actionFormV59674"><div class="dialog-heading"><div><span class="eyebrow">Action</span><h2>${existing?'Edit Action':'New Action'}</h2></div><button type="button" class="icon-button" data-close>×</button></div><input type="hidden" id="actionIdV59674" value="${opEscV59674(a.id||'')}"><div class="form-grid two"><label class="span-two">Action title *<input id="actionTitleV59674" required value="${opEscV59674(a.title||'')}"></label><label class="span-two">Details<textarea id="actionDetailV59674" rows="3">${opEscV59674(a.detail||'')}</textarea></label><label>Priority<select id="actionPriorityV59674"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label>Assigned to<select id="actionAssignedTypeV59674"><option value="office">Office</option><option value="owner">Owner</option><option value="team">Team</option></select></label><label id="actionTeamWrapV59674">Team<select id="actionAssignedIdV59674"><option value="">Choose team</option>${teams}</select></label><label>Due date<input id="actionDueDateV59674" type="date" value="${opEscV59674(a.dueDate||'')}"></label><label>Due time<input id="actionDueTimeV59674" type="time" value="${opEscV59674(a.dueTime||'')}"></label><label>Link to<select id="actionLinkedTypeV59674"><option value="">Nothing / internal</option><option value="client">Client</option><option value="quote">Quote</option><option value="invoice">Invoice</option><option value="proforma">Proforma</option><option value="work_record">Work Record</option><option value="job">Scheduled job</option><option value="work_order">Work Order</option></select></label><label>Linked record/reference<input id="actionLinkedIdV59674" list="actionClientListV59674" value="${opEscV59674(a.linkedId||'')}"><datalist id="actionClientListV59674">${clients}</datalist></label><div class="span-two operational-calendar-link-v59674"><strong>Optional calendar placement</strong><span>The Action remains open even after this date passes.</span></div><label>Calendar date<input id="actionCalendarDateV59674" type="date" value="${opEscV59674(a.calendarDate||'')}"></label><label>Calendar time<input id="actionCalendarTimeV59674" type="time" value="${opEscV59674(a.calendarTime||'')}"></label></div><p id="actionErrorV59674" class="backend-gate-error"></p><div class="dialog-actions">${existing&&!['completed','cancelled'].includes(existing.status)?`<button type="button" class="button danger secondary" data-cancel-action>Cancel Action</button><button type="button" class="button secondary" data-complete>Complete</button>`:''}<button type="button" class="button secondary" data-close>Close</button><button type="submit" class="button">Save Action</button></div></form>`;
  d.querySelector('#actionPriorityV59674').value=a.priority||'normal';d.querySelector('#actionAssignedTypeV59674').value=a.assignedType||'office';d.querySelector('#actionAssignedIdV59674').value=a.assignedId||'';d.querySelector('#actionLinkedTypeV59674').value=a.linkedType||'';
  const sync=()=>d.querySelector('#actionTeamWrapV59674').classList.toggle('hidden',d.querySelector('#actionAssignedTypeV59674').value!=='team');sync();d.querySelector('#actionAssignedTypeV59674').onchange=sync;
  d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('[data-complete]')?.addEventListener('click',async()=>{await completeActionV59674(existing.id);d.close();});
  d.querySelector('[data-cancel-action]')?.addEventListener('click',async()=>{if(!confirm('Cancel this Action?'))return;existing.status='cancelled';existing.cancelledAt=new Date().toISOString();await persistActionV59674(existing);d.close();renderOperationalCentreV59674();});
  d.querySelector('form').onsubmit=async event=>{event.preventDefault();const action=existing||{id:opIdV59674('act'),createdAt:new Date().toISOString(),status:'open'};Object.assign(action,{title:d.querySelector('#actionTitleV59674').value.trim(),detail:d.querySelector('#actionDetailV59674').value.trim(),priority:d.querySelector('#actionPriorityV59674').value,assignedType:d.querySelector('#actionAssignedTypeV59674').value,assignedId:d.querySelector('#actionAssignedTypeV59674').value==='team'?d.querySelector('#actionAssignedIdV59674').value:'',dueDate:d.querySelector('#actionDueDateV59674').value,dueTime:d.querySelector('#actionDueTimeV59674').value,linkedType:d.querySelector('#actionLinkedTypeV59674').value,linkedId:d.querySelector('#actionLinkedIdV59674').value.trim(),calendarDate:d.querySelector('#actionCalendarDateV59674').value,calendarTime:d.querySelector('#actionCalendarTimeV59674').value,status:action.status==='scheduled'&&!d.querySelector('#actionCalendarDateV59674').value?'open':d.querySelector('#actionCalendarDateV59674').value&&action.status==='open'?'scheduled':action.status});if(!action.title)return;try{await persistActionV59674(action);d.close();renderOperationalCentreV59674();if(activeView==='schedule')renderSchedule();toast('Action saved.');}catch(error){d.querySelector('#actionErrorV59674').textContent=typeof backendErrorMessageV28==='function'?backendErrorMessageV28(error):error.message;}};
  d.showModal();
};
window.completeActionV59674=async function(id){const a=(state.operationalActionsV59674||[]).find(row=>row.id===id);if(!a)return;a.status='completed';a.completedAt=new Date().toISOString();await persistActionV59674(a);renderOperationalCentreV59674();if(activeView==='schedule')renderSchedule();toast('Action completed.');};

function workOrderDialogV59674(){let d=document.getElementById('workOrderEditorV59674');if(d)return d;d=document.createElement('dialog');d.id='workOrderEditorV59674';d.className='dialog operational-editor-dialog-v59674';document.body.appendChild(d);return d;}
window.openWorkOrderEditorV59674=function(id='',defaults={}){
  if(!opCanEditV59674())return toast('This profile cannot edit Work Orders.','error');
  const existing=(state.workOrdersV59674||[]).find(w=>w.id===id)||null,w={sourceType:'manual',status:'awaiting_scheduling',...defaults,...existing},d=workOrderDialogV59674();
  const clients=(state.clients||[]).filter(c=>String(c.status||'active')!=='archived').map(c=>`<option value="${opEscV59674(c.id)}">${opEscV59674(c.name||c.address||c.id)}</option>`).join('');
  d.innerHTML=`<form class="dialog-shell" id="workOrderFormV59674"><div class="dialog-heading"><div><span class="eyebrow">Physical work</span><h2>${existing?'Work Order':'New Work Order'}</h2></div><button type="button" class="icon-button" data-close>×</button></div><div class="work-order-state-v59674">${opEscV59674(String(w.status||'awaiting_scheduling').replaceAll('_',' '))}${w.sourceType==='quote'&&w.sourceId?` · Quote ${opEscV59674(opQuoteV59674(w.sourceId)?.number||w.sourceId)}`:''}</div><div class="form-grid two"><label class="span-two">Client *<select id="workOrderClientV59674" required><option value="">Choose client</option>${clients}</select></label><label class="span-two">Work *<input id="workOrderTitleV59674" required value="${opEscV59674(w.title||'')}"></label><label class="span-two">Details<textarea id="workOrderDetailV59674" rows="3">${opEscV59674(w.detail||'')}</textarea></label><label>Expected / quoted value (R)<input id="workOrderValueV59674" type="number" min="0" step="0.01" value="${opEscV59674(w.quotedValue||'')}"></label><label>Estimated minutes<input id="workOrderMinutesV59674" type="number" min="5" step="5" value="${opEscV59674(w.estimatedMinutes||'')}"></label><label>Preferred date<input id="workOrderPreferredV59674" type="date" value="${opEscV59674(w.preferredDate||'')}"></label><label>Due date<input id="workOrderDueV59674" type="date" value="${opEscV59674(w.dueDate||'')}"></label><label class="span-two">Equipment / materials / requirements<textarea id="workOrderRequirementsV59674" rows="2">${opEscV59674(w.requirements||'')}</textarea></label></div><p id="workOrderErrorV59674" class="backend-gate-error"></p><div class="dialog-actions">${existing&&!['completed','cancelled'].includes(w.status)?`<button type="button" class="button danger secondary" data-cancel-order>Cancel Work Order</button>`:''}${existing&&w.status==='awaiting_scheduling'?`<button type="button" class="button secondary" data-schedule>Schedule</button>`:''}<button type="button" class="button secondary" data-close>Close</button><button type="submit" class="button">Save Work Order</button></div></form>`;
  d.querySelector('#workOrderClientV59674').value=w.clientId||'';if(w.sourceType==='quote')d.querySelector('#workOrderClientV59674').disabled=true;
  d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.querySelector('[data-schedule]')?.addEventListener('click',()=>{d.close();scheduleWorkOrderV59674(w.id);});
  d.querySelector('[data-cancel-order]')?.addEventListener('click',async()=>{if(!confirm('Cancel this Work Order?'))return;w.status='cancelled';await persistWorkOrderV59674(w);d.close();renderOperationalCentreV59674();});
  d.querySelector('form').onsubmit=async event=>{event.preventDefault();const order=existing||{id:opIdV59674('wo'),sourceType:w.sourceType||'manual',sourceId:w.sourceId||'',status:'awaiting_scheduling',createdAt:new Date().toISOString()};Object.assign(order,{clientId:d.querySelector('#workOrderClientV59674').value,siteText:opClientV59674(d.querySelector('#workOrderClientV59674').value)?.address||'',title:d.querySelector('#workOrderTitleV59674').value.trim(),detail:d.querySelector('#workOrderDetailV59674').value.trim(),quotedValue:d.querySelector('#workOrderValueV59674').value,estimatedMinutes:d.querySelector('#workOrderMinutesV59674').value,preferredDate:d.querySelector('#workOrderPreferredV59674').value,dueDate:d.querySelector('#workOrderDueV59674').value,requirements:d.querySelector('#workOrderRequirementsV59674').value.trim()});try{await persistWorkOrderV59674(order);d.close();renderOperationalCentreV59674();toast('Work Order saved.');}catch(error){d.querySelector('#workOrderErrorV59674').textContent=typeof backendErrorMessageV28==='function'?backendErrorMessageV28(error):error.message;}};d.showModal();
};

window.scheduleWorkOrderV59674=function(id){
  const w=(state.workOrdersV59674||[]).find(row=>row.id===id);if(!w)return;
  if(w.sourceType==='quote'){
    const quote=opQuoteV59674(w.sourceId),client=opClientV59674(w.clientId)||{};
    try{if(quote&&typeof quoteServiceBasketItemV58940==='function')quoteServiceBasketItemV58940(quote);save?.();}catch(_){ }
    document.getElementById('operationalCentreDialogV59674')?.close();showView('schedule');try{scheduleQueueSearchV58930=client.name||'';}catch(_){ }renderSchedule?.();setTimeout(()=>openScheduleQueue?.(),60);return;
  }
  scheduleWorkOrderDialogV59674(w);
};
function scheduleWorkOrderDialogV59674(order){
  let d=document.getElementById('scheduleWorkOrderDialogV59674');if(!d){d=document.createElement('dialog');d.id='scheduleWorkOrderDialogV59674';d.className='dialog operational-editor-dialog-v59674';document.body.appendChild(d);}const teams=(state.teams||[]).filter(t=>t.active!==false).map(t=>`<option value="${opEscV59674(t.id)}">${opEscV59674(t.name)}</option>`).join('');
  d.innerHTML=`<form class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Place Work Order</span><h2>${opEscV59674(order.title)}</h2></div><button type="button" class="icon-button" data-close>×</button></div><div class="form-grid two"><label>Date *<input id="scheduleWoDateV59674" type="date" required value="${opEscV59674(order.preferredDate||opTodayV59674())}"></label><label>Team *<select id="scheduleWoTeamV59674" required><option value="">Choose team</option>${teams}</select></label><label>Time, optional<input id="scheduleWoTimeV59674" type="time"></label><label>Duration minutes<input id="scheduleWoMinutesV59674" type="number" min="5" step="5" value="${opEscV59674(order.estimatedMinutes||60)}"></label></div><p id="scheduleWoErrorV59674" class="backend-gate-error"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button" type="submit">Add to schedule</button></div></form>`;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.querySelector('form').onsubmit=async event=>{event.preventDefault();const client=opClientV59674(order.clientId)||{},date=d.querySelector('#scheduleWoDateV59674').value,teamId=d.querySelector('#scheduleWoTeamV59674').value,time=d.querySelector('#scheduleWoTimeV59674').value,minutes=Math.max(5,Number(d.querySelector('#scheduleWoMinutesV59674').value||60));const job={id:opIdV59674('sch'),date,clientId:order.clientId,teamId,status:'scheduled',estimatedHours:minutes/60,sort:99,scheduledTime:time,startTime:time,routeTime:time,workKind:'once-off',revenueType:'Work order',workMarker:'O',workOrderIdV59674:order.id,workOrderTitleV59674:order.title,officeNotes:[order.detail,order.requirements].filter(Boolean).join(' · '),manualOverride:true,autoGenerated:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.schedules.push(job);order.status='scheduled';order.scheduledJobId=job.id;order.scheduledDate=date;order.scheduledTeamId=teamId;try{save?.();await persistWorkOrderV59674(order);d.close();document.getElementById('operationalCentreDialogV59674')?.close();showView('schedule');renderSchedule?.();toast('Work Order scheduled.');}catch(error){d.querySelector('#scheduleWoErrorV59674').textContent=error.message;}};d.showModal();
}

function actionCalendarHtmlV59674(teamId,date){
  const rows=openActionsV59674().filter(a=>a.calendarDate===date&&a.assignedType==='team'&&String(a.assignedId)===String(teamId));if(!rows.length)return '';
  return `<div class="schedule-actions-v59674">${rows.map(a=>`<button type="button" class="schedule-action-v59674 ${actionOverdueV59674(a)?'overdue':''}" onclick="event.stopPropagation();openActionEditorV59674('${opEscV59674(a.id)}')"><b>✓</b><span><strong>${opEscV59674(a.title)}</strong>${a.detail?`<small>${opEscV59674(a.detail)}</small>`:''}</span><time>${opEscV59674(a.calendarTime||'Action')}</time></button>`).join('')}</div>`;
}
if(typeof scheduleCell==='function'){
  const before=scheduleCell;scheduleCell=function scheduleCellOperationalV59674(team,date,visibleJobs,allJobs){const html=before(team,date,visibleJobs,allJobs),actions=actionCalendarHtmlV59674(team.id,date);return actions?html.replace('<div class="schedule-lane-cards">',`${actions}<div class="schedule-lane-cards">`):html;};
}

if(typeof renderClients==='function'){
  const before=renderClients;renderClients=function renderClientsOperationalV59674(){const result=before();requestAnimationFrame(decorateClientsScheduleHealthV59674);return result;};
}
if(typeof editClient==='function'){
  const before=window.editClient||editClient;window.editClient=function editClientOperationalV59674(id){const result=before(id);requestAnimationFrame(()=>renderClientSchedulePanelV59674(id));return result;};
}
if(typeof saveClientForm==='function'){
  const before=saveClientForm;saveClientForm=async function saveClientOperationalV59674(event){const id=document.getElementById('clientId')?.value||'';const beforeIds=new Set((state.clients||[]).map(c=>c.id));const result=await Promise.resolve(before(event));const client=id?opClientV59674(id):(state.clients||[]).find(c=>!beforeIds.has(c.id));if(client&&scheduleHealthV59674(client).key==='unscheduled')toast('Client saved — active recurring service is NOT SCHEDULED. It will stay in Needs Attention until scheduled.','error');renderOperationalControlV59674();if(client)renderClientSchedulePanelV59674(client.id);return result;};
}
if(typeof renderSchedule==='function'){
  const before=renderSchedule;renderSchedule=function renderScheduleOperationalV59674(){const result=before();requestAnimationFrame(renderOperationalControlV59674);return result;};
}
if(typeof refreshAppAfterCloudLoadV28==='function'){
  const before=refreshAppAfterCloudLoadV28;refreshAppAfterCloudLoadV28=function refreshOperationalV59674(){const result=before();setTimeout(()=>loadOperationalControlV59674({force:true}),0);return result;};
}

function initialiseOperationalV59674(){renderOperationalControlV59674();if(backendV28?.businessId)loadOperationalControlV59674({force:true});setInterval(()=>{if(document.visibilityState==='visible'&&backendV28?.businessId)loadOperationalControlV59674({force:true});},60000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialiseOperationalV59674,{once:true});else setTimeout(initialiseOperationalV59674,0);

window.scheduleHealthV59674=scheduleHealthV59674;
window.unscheduledRecurringV59674=unscheduledRecurringV59674;
window.openActionsV59674=openActionsV59674;
window.awaitingWorkOrdersV59674=awaitingWorkOrdersV59674;
window.loadOperationalControlV59674=loadOperationalControlV59674;
window.renderOperationalControlV59674=renderOperationalControlV59674;
window.__tuinbooksOperationalControlTestV59674={build:BUILD,scheduleHealth:true,teamNotesPersistence:true,internalEventsPersistence:true,persistentActions:true,overdueComputed:true,calendarActions:true,workOrders:true,quoteWorkOrders:true,workOrderToSchedule:true,needsAttention:true};
window.__tuinbooksOperationalControlBuild=BUILD;
})();
