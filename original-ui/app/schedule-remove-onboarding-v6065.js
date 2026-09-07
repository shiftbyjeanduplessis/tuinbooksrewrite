/* TuinBooks v60.6.5 — remove legacy Schedule onboarding import button.
   Workbook import/export remains under Business -> Import / Export only. */
(()=>{
  const BUILD='60.6.5-remove-schedule-onboarding-button';
  let queued=false;

  function normalizeText(v){
    return String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function removeLegacyOnboardingButtons(){
    queued=false;

    // Remove the original legacy trigger wherever an older layer recreates it.
    document.querySelectorAll('#openOnboardingMasterImportV60420').forEach(el=>el.remove());

    // Defensive removal for cloned/re-rendered Schedule buttons that may not retain the old id.
    const schedule=document.getElementById('view-schedule');
    if(schedule){
      schedule.querySelectorAll('button,a').forEach(el=>{
        if(normalizeText(el.textContent)==='import onboarding workbook') el.remove();
      });
    }
  }

  function queue(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(removeLegacyOnboardingButtons);
  }

  function boot(){
    removeLegacyOnboardingButtons();
    const observer=new MutationObserver(queue);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.__tuinbooksRemoveScheduleOnboardingBuild=BUILD;
})();
