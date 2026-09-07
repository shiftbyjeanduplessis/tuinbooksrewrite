/* TuinBooks v60.0.1 canary status — Schedule Stage 1A */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  function boot(){
    document.querySelector('.tuinbooks-canary-status-v6000')?.remove();
    document.querySelector('.tuinbooks-canary-status-v6001')?.remove();
    const el=document.createElement('div');el.className='tuinbooks-canary-status-v6001';
    const renderer=window.__tuinbooksConsolidatedScheduleBuild||'not loaded';
    el.innerHTML=`<strong>v60 Schedule Stage 1A</strong> · renderer ${renderer} · production index untouched`;
    document.body.appendChild(el);
    document.documentElement.dataset.tuinbooksCanary='v6001';
    console.info('[TuinBooks v60 canary Stage 1A]',{renderer,productionIndexUntouched:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();
