/* TuinBooks v60.0.4 CANARY — Schedule Stage 1A scope bind */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;

  const BUILD='60.0.4-schedule-stage-1a-scope-bind';
  let operationalRequested=false;
  let lastRenderSignature='';
  let lastRenderAt=0;
  let lastError='';

  function params(){
    const p=new URLSearchParams(location.search);
    return {support:p.get('support')==='1',business:p.get('business')||'',session:p.get('session')||''};
  }
  function scheduleVisible(){
    return !!document.querySelector('#view-schedule.app-view.active') ||
      String(window.activeView||'')==='schedule' ||
      !!document.querySelector('.nav-tab.active[data-view="schedule"]');
  }
  function diag(){
    const backend=window.backendV28||{};
    const runtimeState=window.state||{};
    const route=params();
    return {
      route,
      coreReady:!!backend.managementCoreReadyV5950,
      operationalReady:!!backend.managementOperationalReadyV5950,
      operationalInFlight:!!window.managementOperationalPromiseV5950,
      businessId:String(backend.businessId||''),
      teams:Array.isArray(runtimeState.teams)?runtimeState.teams.length:0,
      schedules:Array.isArray(runtimeState.schedules)?runtimeState.schedules.length:0,
      activeView:String(window.activeView||''),
      scheduleVisible:scheduleVisible(),
      renderer:document.documentElement.dataset.scheduleRenderer||'waiting'
    };
  }

  function requestOperationalData(){
    const d=diag();
    if(!d.route.support||!d.coreReady||d.operationalReady||operationalRequested)return;
    operationalRequested=true;
    lastError='';
    let operation;
    try{
      // Use the existing audited Management operational loader. This is the
      // same read path production uses; the canary does not create a second
      // schedule loader or touch recurrence generation.
      if(window.__tuinbooksFastManagementNavigationV59669?.preload){
        operation=window.__tuinbooksFastManagementNavigationV59669.preload();
      }else if(typeof window.loadManagementOperationalV5950==='function'){
        operation=window.loadManagementOperationalV5950();
      }else if(typeof window.showView==='function'){
        operation=window.showView('schedule');
      }
    }catch(error){
      lastError=String(error?.message||error||'Operational load failed');
      operationalRequested=false;
      return;
    }
    Promise.resolve(operation).then(()=>{
      operationalRequested=false;
      setTimeout(()=>forceScheduleRender('operational-load-complete'),0);
    }).catch(error=>{
      operationalRequested=false;
      lastError=String(error?.message||error||'Operational load failed');
      console.error('[TuinBooks v60.0.4] operational hydration failed',error);
    });
  }

  function forceScheduleRender(reason='poll'){
    const d=diag();
    if(!d.scheduleVisible)return false;
    if(d.route.support&&!d.operationalReady)return false;
    if(typeof window.renderSchedule!=='function')return false;

    const signature=[d.businessId,d.operationalReady,d.teams,d.schedules,d.activeView].join('|');
    const now=Date.now();
    if(reason==='poll'&&signature===lastRenderSignature&&now-lastRenderAt<4000&&d.renderer==='v6002')return false;

    try{
      window.renderSchedule();
      lastRenderSignature=signature;
      lastRenderAt=now;
      lastError='';
      return true;
    }catch(error){
      lastError=String(error?.message||error||'Schedule render failed');
      console.error('[TuinBooks v60.0.4] schedule render failed',error);
      return false;
    }
  }

  function installStatus(){
    document.querySelector('.tuinbooks-canary-status-v6000')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6001')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6002')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6004')?.remove();
    const el=document.createElement('div');
    el.className='tuinbooks-canary-status-v6004';
    document.body.appendChild(el);
    const update=()=>{
      const d=diag();
      let phase='waiting for workspace';
      if(d.coreReady&&!d.operationalReady)phase=d.operationalInFlight||operationalRequested?'loading schedule data':'schedule data not loaded';
      if(d.operationalReady)phase='schedule data ready';
      const error=lastError?` · ERROR ${lastError}`:'';
      el.innerHTML=`<strong>v60 Schedule Stage 1A SCOPE BIND</strong> · ${phase} · renderer ${d.renderer} · ${d.schedules} loaded jobs · ${d.teams} teams${error}`;
    };
    update();
    setInterval(update,750);
  }

  function tick(){
    const d=diag();
    if(d.route.support&&d.coreReady&&!d.operationalReady)requestOperationalData();
    if((!d.route.support||d.operationalReady)&&d.scheduleVisible)forceScheduleRender('poll');
  }

  function boot(){
    document.documentElement.dataset.tuinbooksCanary='v6004';
    installStatus();
    tick();
    setInterval(tick,500);
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>{requestOperationalData();forceScheduleRender('schedule-tab');},50);
    },true);
    window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(tick,0));
    console.info('[TuinBooks v60.0.4 canary]',{build:BUILD,productionIndexUntouched:true,hydrationBind:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});
  else setTimeout(boot,0);
})();
