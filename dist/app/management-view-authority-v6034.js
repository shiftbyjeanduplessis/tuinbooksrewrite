/* TuinBooks v60.3.4 — Management view authority during hydration */
(()=>{
  'use strict';
  const p=new URLSearchParams(location.search);
  if(document.body?.dataset?.app!=='desktop'||p.get('support')!=='1'||!p.get('business'))return;
  let desired='';let lockUntil=0;let seq=0;
  const operationalViews=new Set(['schedule','records','quotes','invoices','business','year','reports']);
  function current(){return document.querySelector('.nav-tab.active[data-view]')?.dataset?.view||String(window.activeView||'');}
  function opReady(){const b=window.backendV28||{};return !!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371);}
  function coreReady(){return !!window.backendV28?.managementCoreReadyV5950;}
  function requestOperational(){
    if(!coreReady()||opReady())return;
    try{
      if(window.__tuinbooksFastManagementNavigationV59669?.preload)window.__tuinbooksFastManagementNavigationV59669.preload();
      else window.loadManagementOperationalV5950?.();
    }catch(error){console.warn('[v60.3.4] preload request',error);}
  }
  function restore(reason='poll'){
    if(!desired||Date.now()>lockUntil)return false;
    if(current()===desired)return true;
    if(!coreReady())return false;
    if(operationalViews.has(desired)&&!opReady()){requestOperational();return false;}
    try{window.showView?.(desired);return true;}catch(error){console.warn('[v60.3.4] view restore',reason,error);return false;}
  }
  document.addEventListener('click',event=>{
    const tab=event.target?.closest?.('.nav-tab[data-view]');if(!tab)return;
    desired=tab.dataset.view||'';lockUntil=Date.now()+15000;seq++;
    if(operationalViews.has(desired))requestOperational();
    setTimeout(()=>restore('tab-click'),40);
  },true);
  const observer=new MutationObserver(()=>{if(desired&&Date.now()<=lockUntil&&current()!==desired)setTimeout(()=>restore('mutation'),0);});
  document.querySelectorAll('.nav-tab[data-view],.app-view').forEach(node=>observer.observe(node,{attributes:true,attributeFilter:['class']}));
  window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>restore('runtime-ready'),0));
  const timer=setInterval(()=>restore('poll'),300);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);observer.disconnect();},{once:true});
  window.__tuinbooksManagementViewAuthorityV6034={build:'60.3.4',desired:()=>desired,current};
})();
