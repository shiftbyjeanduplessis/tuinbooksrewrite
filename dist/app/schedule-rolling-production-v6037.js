/* TuinBooks 60.3.7-exact-v6011-canary-promotion — restore the canonical rolling engine after exact v60.0.11 canary hydration. */
(()=>{
  'use strict';
  const BUILD='60.3.7-exact-v6011-canary-promotion';
  const canonical=window.__tuinbooksCanonicalRollingV6010||{};
  if(typeof canonical.ensure!=='function'||typeof canonical.refresh!=='function'||typeof canonical.generate!=='function'){console.warn('[TuinBooks v60.3.7] canonical rolling engine unavailable');return;}
  window.ensureRollingScheduleV58929=canonical.ensure;
  window.scheduleRollingRefreshV58929=canonical.refresh;
  window.generateRecurringWeek=canonical.generate;
  let started=false;
  function ready(){
    const p=new URLSearchParams(location.search),b=window.backendV28||{};
    if(p.get('support')==='1')return !!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371);
    return !!b.businessId&&Array.isArray(window.state?.teams)&&Array.isArray(window.state?.schedules);
  }
  async function start(){
    if(started||document.body?.dataset?.app!=='desktop'||!ready())return false;
    started=true;
    try{await canonical.ensure();try{window.renderSchedule?.();}catch{}return true;}catch(error){started=false;console.error('[TuinBooks v60.3.7] rolling Schedule start failed',error);return false;}
  }
  const timer=setInterval(()=>{if(start())clearInterval(timer);},500);
  window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(start,0));
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(start,100);},true);
  window.__tuinbooksScheduleProductionV6037={build:BUILD,start};
})();
