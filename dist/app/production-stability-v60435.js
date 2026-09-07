/* TuinBooks v60.4.35 — isolated production stability guard.
   No schema changes. No destructive data operations. */
(()=>{
  'use strict';
  const BUILD='60.4.35-production-stability-guard';
  let renderWrapped=false;
  let missedPatched=false;
  let rollingTimer=0;

  const todayIso=()=>{
    try{if(typeof window.localDateISO==='function')return window.localDateISO();}catch(_){ }
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const normalStatus=value=>String(value||'scheduled').toLowerCase().replace(/[\s-]+/g,'_');

  function clearStaleDragUi(){
    try{
      document.body?.classList.remove('schedule-drag-active');
      document.querySelectorAll('.schedule-insert-zone-v58930.active').forEach(node=>node.classList.remove('active'));
      document.querySelectorAll('.schedule-day-lane.drag-preview').forEach(node=>node.classList.remove('drag-preview'));
    }catch(_){ }
  }

  function patchCurrentDayMissed(){
    if(missedPatched||typeof window.jobMissedLiveV59377!=='function')return;
    const base=window.jobMissedLiveV59377;
    const patched=function(job,date=job?.date){
      const d=String(date||job?.date||'').slice(0,10),status=normalStatus(job?.status);
      // Current-day jobs are not automatically "missed" merely because a later
      // route item was completed out of order. Only an explicit missed status may
      // make today's card red. Past unresolved work keeps the established logic.
      if(d===todayIso()&&!['missed','missed_unresolved'].includes(status))return false;
      return base(job,date);
    };
    patched.__tuinbooksV60435=true;
    try{window.jobMissedLiveV59377=patched;}catch(_){ }
    try{jobMissedLiveV59377=patched;}catch(_){ }
    missedPatched=true;
  }

  function repairPendingNewRecurring(){
    try{
      const runtime=window.__tuinbooksOnboardingRuntimeV60423;
      const state=runtime?.getState?.();
      if(!state||typeof window.addNewRecurringClientToBasketV6036!=='function')return false;
      let changed=false;
      const recurring=new Set(['Weekly','Fortnightly','Monthly']);
      for(const client of state.clients||[]){
        if(client?.awaitingInitialRecurringPlacementV6036!==true)continue;
        if(!recurring.has(String(client.frequency||'')))continue;
        const hasBasket=(state.scheduleBasket||[]).some(item=>item?.newRecurringV6036===true&&String(item.clientId||item?.jobPayload?.clientId||'')===String(client.id));
        const hasPlaced=(state.schedules||[]).some(job=>String(job.clientId||'')===String(client.id)&&String(job.status||'').toLowerCase()!=='cancelled');
        if(!hasBasket&&!hasPlaced){window.addNewRecurringClientToBasketV6036(client);changed=true;}
      }
      if(changed){try{runtime.save?.();}catch(_){ }}
      return changed;
    }catch(error){console.warn('[v60.4.35] NEW R repair skipped',error);return false;}
  }

  function refreshScheduleChrome(){
    clearStaleDragUi();
    patchCurrentDayMissed();
    try{repairPendingNewRecurring();}catch(_){ }
    try{window.renderScheduleQueue?.();}catch(error){console.warn('[v60.4.35] basket render',error);}
  }

  function requestRollingMaintenance(reason='stability-guard'){
    clearTimeout(rollingTimer);
    rollingTimer=setTimeout(()=>{
      try{
        if(String(window.activeView||'')!=='schedule')return;
        const runtime=window.__tuinbooksOnboardingRuntimeV60423;
        const backend=runtime?.getBackend?.();
        if(backend?.mode==='supabase'&&!backend?.businessId)return;
        window.scheduleRollingRefreshV58929?.(reason,160);
      }catch(error){console.warn('[v60.4.35] rolling maintenance',error);}
    },220);
  }

  function wrapScheduleRender(){
    if(renderWrapped||typeof window.renderSchedule!=='function')return;
    const base=window.renderSchedule;
    const wrapped=function(...args){
      clearStaleDragUi();
      patchCurrentDayMissed();
      const result=base.apply(this,args);
      queueMicrotask(()=>{
        refreshScheduleChrome();
        requestRollingMaintenance('schedule-render-v60435');
      });
      return result;
    };
    wrapped.__tuinbooksV60435=true;
    window.renderSchedule=wrapped;
    try{renderSchedule=wrapped;}catch(_){ }
    renderWrapped=true;
  }

  function boot(){
    clearStaleDragUi();
    patchCurrentDayMissed();
    wrapScheduleRender();
    refreshScheduleChrome();
    if(String(window.activeView||'')==='schedule')requestRollingMaintenance('schedule-open-v60435');
    document.documentElement.dataset.tuinbooksStability='v60435';
    window.__tuinbooksProductionStabilityV60435={build:BUILD,clearStaleDragUi,repairPendingNewRecurring,requestRollingMaintenance};
  }

  // Always clear stale drag presentation when a real drag ends or the window loses focus.
  ['dragend','drop','pointerup','mouseup','touchend'].forEach(type=>document.addEventListener(type,()=>setTimeout(clearStaleDragUi,0),true));
  window.addEventListener('blur',clearStaleDragUi);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')clearStaleDragUi();});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});
  else setTimeout(boot,0);
  // Some management hydration wrappers install after DOM ready. Reassert only this
  // isolated guard once, without replacing any app module.
  setTimeout(()=>{patchCurrentDayMissed();wrapScheduleRender();refreshScheduleChrome();},900);
})();
