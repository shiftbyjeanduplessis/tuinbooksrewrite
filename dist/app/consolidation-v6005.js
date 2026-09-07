/* TuinBooks v60.0.5 CANARY status — Schedule Stage 1B Operations */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  function boot(){
    document.querySelectorAll('.tuinbooks-canary-status-v6000,.tuinbooks-canary-status-v6001,.tuinbooks-canary-status-v6002,.tuinbooks-canary-status-v6004,.tuinbooks-canary-status-v6005').forEach(node=>node.remove());
    const el=document.createElement('div');el.className='tuinbooks-canary-status-v6005';document.body.appendChild(el);
    const refresh=()=>{
      const backend=window.backendV28||{},state=window.state||{},diag=window.__tuinbooksScheduleConsolidationV6005||{};
      const renderer=document.documentElement.dataset.scheduleRenderer||'waiting';
      const horizon=diag.horizon;const changes=horizon?Number(horizon.created||0)+Number(horizon.updated||0)+Number(horizon.removed||0)+Number(horizon.queued||0):null;
      el.innerHTML=`<strong>v60 Schedule Stage 1B</strong> · renderer ${renderer} · ${(state.schedules||[]).length} loaded jobs · ${(state.teams||[]).length} teams · ${diag.actions??'…'} team-day items · 8-week ${changes===null?'preview waiting':`${changes} dry-run changes`} · ${backend.managementOperationalReadyV5950?'schedule data ready':'loading'}`;
    };
    refresh();setInterval(refresh,750);document.documentElement.dataset.tuinbooksCanary='v6005';
    console.info('[TuinBooks v60.0.5 canary]',{stage:'Schedule 1B operations',productionIndexUntouched:true,autoHorizonWrites:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
