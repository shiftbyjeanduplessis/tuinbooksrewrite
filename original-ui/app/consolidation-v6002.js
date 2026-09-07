/* TuinBooks v60.0.2 canary status — Schedule Stage 1A authority fix */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  function boot(){
    document.querySelector('.tuinbooks-canary-status-v6000')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6001')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6002')?.remove();
    const el=document.createElement('div');
    el.className='tuinbooks-canary-status-v6002 tuinbooks-canary-status-v6001';
    document.body.appendChild(el);
    const refresh=()=>{
      const diag=window.__tuinbooksScheduleConsolidationV6002||{};
      const renderer=document.documentElement.dataset.scheduleRenderer||'waiting';
      const jobs=Number.isFinite(diag.totalScheduleJobs)?diag.totalScheduleJobs:'…';
      const week=Number.isFinite(diag.visibleWeekJobs)?diag.visibleWeekJobs:'…';
      el.innerHTML=`<strong>v60 Schedule Stage 1A FIX</strong> · renderer ${renderer} · ${jobs} loaded jobs · ${week} in selected week · read-only auto-refresh`;
    };
    refresh();
    setInterval(refresh,1000);
    document.documentElement.dataset.tuinbooksCanary='v6002';
    console.info('[TuinBooks v60 canary Stage 1A authority fix]',{productionIndexUntouched:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();
