/* TuinBooks v60.0.7 CANARY — final authority after legacy/stability wrappers */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  const BUILD='60.0.7-schedule-stage-1b-actual-authority';

  function scheduleVisible(){
    return !!document.querySelector('#view-schedule.app-view.active') ||
      String(window.activeView||'')==='schedule' ||
      !!document.querySelector('.nav-tab.active[data-view="schedule"]');
  }
  function reclaim(force=false){
    if(typeof window.__tuinbooksV6007RenderSchedule!=='function')return false;
    const changed=window.renderSchedule!==window.__tuinbooksV6007RenderSchedule;
    if(changed)window.renderSchedule=window.__tuinbooksV6007RenderSchedule;
    const toolbarMissing=!document.querySelector('#rollingScheduleOverview .v6007-ops');
    const rendererWrong=document.documentElement.dataset.scheduleRenderer!=='v6007';
    if(scheduleVisible()&&(force||changed||toolbarMissing||rendererWrong)){
      try{window.__tuinbooksV6007RenderSchedule();}catch(error){console.error('[TuinBooks v60.0.7] final Schedule render',error);}
    }
    return true;
  }
  function enforceBasket(){
    if(document.body.classList.contains('v6007-basket-open'))return;
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(drawer){drawer.classList.add('hidden');drawer.style.setProperty('display','none','important');}
    document.getElementById('scheduleBasketLauncherV58931')?.classList.add('hidden');
  }
  function installStatus(){
    document.querySelectorAll('[class^="tuinbooks-canary-status-v600"]').forEach(n=>n.remove());
    const el=document.createElement('div');el.className='tuinbooks-canary-status-v6007';document.body.appendChild(el);
    const update=()=>{
      const state=window.state||{},diag=window.__tuinbooksScheduleConsolidationV6007||{};
      const toolbar=!!document.querySelector('#rollingScheduleOverview .v6007-ops');
      const noteButtons=document.querySelectorAll('.v6007-day-add button').length;
      el.innerHTML=`<strong>v60 Schedule Stage 1B AUTHORITY</strong> · renderer ${document.documentElement.dataset.scheduleRenderer||'waiting'} · ${(state.schedules||[]).length} loaded jobs · ${(state.teams||[]).length} teams · toolbar ${toolbar?'yes':'NO'} · day actions ${noteButtons} · basket ${document.body.classList.contains('v6007-basket-open')?'open':'closed'} · production index untouched`;
    };
    update();setInterval(update,700);
  }
  function boot(){
    document.documentElement.dataset.tuinbooksCanary='v6007';
    reclaim(true);enforceBasket();installStatus();
    setInterval(()=>{reclaim(false);enforceBasket();},1200);
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>reclaim(true),50);
    },true);
    window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>reclaim(true),0));
    console.info('[TuinBooks v60.0.7 canary]',{build:BUILD,finalAuthorityAfterStabilityWrapper:true,productionIndexUntouched:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});
  else setTimeout(boot,0);
})();
