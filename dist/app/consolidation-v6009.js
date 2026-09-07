/* TuinBooks v60.0.9 CANARY
   Goal: preserve the current compact calendar, put Note/Event actions ON each team/day,
   leave the established floating Basket alone, and guarantee the recurring-move scope prompt.
*/
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  const BUILD='60.0.9-schedule-calendar-actions';
  const terminal=new Set(['completed','cancelled','canceled','rescheduled','deferred','no-charge','access-failed']);
  let promptedJobId='';
  let promptedAt=0;

  function isoToday(){
    try{return window.localDateISO?.()||new Date().toISOString().slice(0,10);}catch{return new Date().toISOString().slice(0,10);}
  }
  function isPast(date){return String(date||'')<isoToday();}
  function clientFor(job){return (window.state?.clients||[]).find(c=>String(c.id)===String(job?.clientId))||null;}
  function teamFor(id){return (window.state?.teams||[]).find(t=>String(t.id)===String(id))||null;}
  function dayName(date){
    try{if(typeof window.dayName==='function')return window.dayName(date);}catch{}
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(`${date}T12:00:00`).getDay()];
  }
  function recurring(job){
    if(!job)return false;
    try{if(typeof window.workMarkerForJobV5546==='function'&&window.workMarkerForJobV5546(job)==='R')return true;}catch{}
    const client=clientFor(job)||{};
    const text=`${job.revenueType||''} ${job.workKind||''} ${client.recordKindV58951||''} ${client.frequency||''}`.toLowerCase();
    return /recurring|weekly|fortnight|biweekly|bi weekly|monthly|every 2 week|every week|routine/.test(text);
  }
  function readDragJob(event){
    try{
      const raw=event?.dataTransfer?.getData?.('application/json');
      if(!raw)return null;
      const data=JSON.parse(raw);
      if(data?.type!=='job'||!data.id)return null;
      return (window.state?.schedules||[]).find(j=>String(j.id)===String(data.id))||null;
    }catch{return null;}
  }
  function weekStart(date){
    try{return window.startOfWeek?.(date)||date;}catch{return date;}
  }
  function addDays(date,n){
    try{return window.dateAdd?.(date,n)||date;}catch{
      const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);
    }
  }
  function workdayIndex(date){
    const d=new Date(`${date}T12:00:00`).getDay();
    // Monday=0 ... Saturday=5. Sunday is not a standard garden-service schedule day.
    return d===0?6:d-1;
  }
  function saveState(){
    try{window.save?.();return true;}catch(error){console.error('[v6009] save failed',error);return false;}
  }
  function applyFuturePattern(job){
    const state=window.state||{},client=clientFor(job),team=teamFor(job.teamId);if(!client||!team)return {updated:0};
    const anchor=String(job.date||''),day=dayName(anchor),idx=workdayIndex(anchor);
    client.preferredDay=day;
    client.preferredTeamId=team.id;
    client.teamId=team.id;
    client.recurrenceAnchorDate=anchor;
    // This is an explicit office instruction, not an import guess.
    if(client.autoScheduleEnabled!==false)client.autoScheduleEnabled=true;
    if(client.scheduleSource!=='diary')client.scheduleSource=client.scheduleSource||'confirmed-recurring';

    (state.serviceAgreements||[]).filter(a=>String(a.clientId)===String(client.id)&&String(a.status||'').toLowerCase()==='active').forEach(a=>{
      a.preferredDays=[day];a.defaultTeamId=team.id;a.updatedAt=new Date().toISOString();
      (a.lines||[]).filter(line=>line.active!==false).forEach(line=>{line.anchorDate=anchor;});
    });

    let updated=0;
    (state.schedules||[]).forEach(future=>{
      if(String(future.id)===String(job.id)||String(future.clientId)!==String(job.clientId))return;
      if(String(future.date||'')<=anchor)return;
      if(terminal.has(String(future.status||'scheduled').toLowerCase()))return;
      if(!recurring(future))return;
      // A deliberately moved future exception stays where the office put it.
      if(future.manualOverride===true)return;
      const monday=weekStart(future.date),target=addDays(monday,idx);
      future.date=target;future.teamId=team.id;future.autoAssigned=true;future.updatedAt=new Date().toISOString();
      future.audit=[...(future.audit||[]),{at:new Date().toISOString(),actor:'Office',action:'Recurring pattern updated',note:`${day} · ${team.name||'Team'}`}];
      updated++;
    });
    job.audit=[...(job.audit||[]),{at:new Date().toISOString(),actor:'Office',action:'Recurring move confirmed',note:`This + future visits · ${day} · ${team.name||'Team'}`}];
    saveState();
    try{window.renderSchedule?.();}catch{}
    return {updated,day,team:team.name||'Team'};
  }
  function showRecurringScope(job,before){
    if(!job||!recurring(job))return;
    const changed=String(before?.date||'')!==String(job.date||'')||String(before?.teamId||'')!==String(job.teamId||'');
    if(!changed)return;
    const now=Date.now();if(promptedJobId===String(job.id)&&now-promptedAt<1000)return;
    promptedJobId=String(job.id);promptedAt=now;
    const existing=document.getElementById('recurringPlacementDialogV58930');if(existing?.open)return;

    let dialog=document.getElementById('recurringMoveDialogV6009');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='recurringMoveDialogV6009';dialog.className='dialog recurring-placement-dialog-v58930';document.body.appendChild(dialog);}
    const client=clientFor(job)||{},team=teamFor(job.teamId)||{};
    const name=client.name||client.displayName||'This client';
    dialog.innerHTML=`<form method="dialog" class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Recurring visit moved</span><h2>How should this move apply?</h2></div><button class="icon-button" value="cancel" aria-label="Close">×</button></div><p><strong>${escapeHtml(name)}</strong> was moved to <strong>${escapeHtml(dayName(job.date))}</strong>${team.name?` with <strong>${escapeHtml(team.name)}</strong>`:''}.</p><div class="recurring-scope-options-v6005"><button class="recurring-scope-card-v6005" value="once"><strong>This visit only</strong><span>Keep the normal recurring pattern unchanged.</span></button><button class="recurring-scope-card-v6005 primary" value="future"><strong>This + future visits</strong><span>Use this day/team as the recurring pattern from this visit onward.</span></button></div></form>`;
    dialog.onclose=()=>{
      if(dialog.returnValue==='future'){
        const result=applyFuturePattern(job);
        window.toast?.(`Recurring pattern updated to ${result.day} · ${result.team}.${result.updated?` ${result.updated} future visit${result.updated===1?'':'s'} moved.`:''}`);
      }else if(dialog.returnValue==='once'){
        window.toast?.('This visit only was moved. The normal recurring pattern is unchanged.');
      }
    };
    dialog.showModal();
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

  function openAction(kind,teamId,date){
    if(typeof window.openScheduleActionForDayV6007==='function'){
      window.openScheduleActionForDayV6007(kind,teamId,date);return;
    }
    window.openScheduleActionEditorV6005?.(kind);
    queueMicrotask(()=>{
      const dateInput=document.getElementById('scheduleActionDateV6005'),team=document.getElementById('scheduleActionTeamV6005');
      if(dateInput)dateInput.value=date;if(team)team.value=teamId;
    });
  }
  window.openCalendarActionV6009=openAction;

  function patchCalendarActions(){
    document.querySelectorAll('#weeklyScheduleBoard .schedule-day-lane[data-team-id][data-date]').forEach(lane=>{
      const date=lane.dataset.date||'',teamId=lane.dataset.teamId||'',head=lane.querySelector('.schedule-lane-head');
      if(!head)return;
      head.classList.toggle('v6009-has-actions',!isPast(date));
      head.querySelector(':scope > .v6009-calendar-actions')?.remove();
      if(isPast(date))return;
      const wrap=document.createElement('div');wrap.className='v6009-calendar-actions';
      wrap.innerHTML=`<button type="button" data-kind="team_note" title="Add a day instruction for this team">+ Note</button><button type="button" data-kind="internal_event" title="Add a non-client calendar event for this team">+ Event</button>`;
      wrap.addEventListener('click',event=>{
        const btn=event.target.closest('button[data-kind]');if(!btn)return;
        event.preventDefault();event.stopPropagation();openAction(btn.dataset.kind,teamId,date);
      });
      head.appendChild(wrap);
    });
  }

  // Use the compact/history Stage-1A renderer that is already proven on Stepping Stones,
  // then decorate the actual team/day calendar instead of adding another page-level toolbar.
  const baseRender=(typeof window.renderScheduleConsolidatedV6002==='function')?window.renderScheduleConsolidatedV6002:window.renderSchedule;
  function renderV6009(){
    const result=baseRender?.();
    document.getElementById('v6008ScheduleOps')?.remove();
    document.querySelector('.v6007-ops')?.remove();
    document.getElementById('scheduleOperationsToolbarV6005')?.remove();
    document.getElementById('scheduleToolbarV6006')?.remove();
    patchCalendarActions();
    document.documentElement.dataset.scheduleRenderer='v6009';
    return result;
  }
  window.renderSchedule=renderV6009;

  // Restore the normal basket close behaviour: closing the floating basket must reveal its launcher again.
  const closeBasketBase=window.closeScheduleQueue;
  if(typeof closeBasketBase==='function')window.closeScheduleQueue=function closeBasketV6009(){const r=closeBasketBase();try{window.renderScheduleQueue?.();}catch{}return r;};

  // Guarantee the move-scope question after a real drag, even if an older drop path forgets it.
  const dropBase=window.scheduleDropAtPositionV58930;
  if(typeof dropBase==='function')window.scheduleDropAtPositionV58930=function dropAtPositionV6009(event,teamId,date,index){
    const moving=readDragJob(event),before=moving?{date:String(moving.date||''),teamId:String(moving.teamId||'')}:null;
    const result=dropBase(event,teamId,date,index);
    if(moving&&before)setTimeout(()=>showRecurringScope(moving,before),120);
    return result;
  };
  window.scheduleDrop=function scheduleDropV6009(event,teamId,date){
    const count=(window.state?.schedules||[]).filter(j=>String(j.teamId)===String(teamId)&&String(j.date)===String(date)&&String(j.status||'').toLowerCase()!=='cancelled').length;
    return window.scheduleDropAtPositionV58930(event,teamId,date,count);
  };

  // Also cover the Move dialog route when it is globally exposed.
  const saveMoveBase=window.saveMoveJobV20;
  if(typeof saveMoveBase==='function')window.saveMoveJobV20=function saveMoveV6009(event){
    const id=document.getElementById('moveScheduleJobId')?.value,job=(window.state?.schedules||[]).find(j=>String(j.id)===String(id)),before=job?{date:String(job.date||''),teamId:String(job.teamId||'')}:null;
    const result=saveMoveBase(event);if(job&&before)setTimeout(()=>showRecurringScope(job,before),120);return result;
  };

  function installStatus(){
    document.querySelectorAll('[class^="tuinbooks-canary-status-v600"]').forEach(n=>n.remove());
    const el=document.createElement('div');el.className='tuinbooks-canary-status-v6009';document.body.appendChild(el);
    const update=()=>{
      const state=window.state||{},controls=document.querySelectorAll('.v6009-calendar-actions').length;
      el.innerHTML=`<strong>v60.0.9 CALENDAR ACTIONS</strong> · ${(location.pathname.endsWith('consolidation-v6009.html'))?'unique page YES':'WRONG PAGE'} · renderer ${document.documentElement.dataset.scheduleRenderer||'waiting'} · ${(state.schedules||[]).length} loaded jobs · ${(state.teams||[]).length} teams · ${controls} team-day action sets · normal basket · production index untouched`;
    };
    update();setInterval(update,900);
  }

  function boot(){
    document.documentElement.dataset.tuinbooksCanary='v6009';
    // Start with the established basket closed, but do not keep forcing it closed afterwards.
    try{window.closeScheduleQueue?.();window.renderScheduleQueue?.();}catch{}
    try{renderV6009();}catch(error){console.error('[v6009] initial Schedule render',error);}
    installStatus();
    document.addEventListener('click',event=>{if(event.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>{try{renderV6009();}catch{}},80);},true);
    window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>{try{renderV6009();}catch{}},0));
    console.info('[TuinBooks v60.0.9 canary]',{build:BUILD,calendarNativeActions:true,normalBasket:true,recurringMovePrompt:true,productionIndexUntouched:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
