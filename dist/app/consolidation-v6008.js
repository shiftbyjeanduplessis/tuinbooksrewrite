/* TuinBooks v60.0.8 CANARY — unique entry/cache bypass + independent schedule ops */
(()=>{
  'use strict';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__)return;
  const BUILD='60.0.8-schedule-stage-1b-cache-bypass';
  function scheduleView(){return document.getElementById('view-schedule');}
  function installOps(){
    const view=scheduleView();if(!view)return false;
    let bar=document.getElementById('v6008ScheduleOps');
    if(!bar){
      bar=document.createElement('section');bar.id='v6008ScheduleOps';
      bar.innerHTML=`<div class="v6008-copy"><strong>Schedule operations</strong><small>This bar belongs to the v60.0.8 canary page. If you can see it, the new canary is definitely loaded.</small></div><div class="v6008-actions"><button class="primary" type="button" data-v6008-note>+ Day instruction</button><button type="button" data-v6008-event>+ Ad-hoc event</button><button type="button" data-v6008-basket>Basket</button></div>`;
      const first=view.firstElementChild;first?view.insertBefore(bar,first):view.appendChild(bar);
      bar.querySelector('[data-v6008-note]').onclick=()=>window.openScheduleActionEditorV6005?.('team_note');
      bar.querySelector('[data-v6008-event]').onclick=()=>window.openScheduleActionEditorV6005?.('internal_event');
      bar.querySelector('[data-v6008-basket]').onclick=()=>window.openScheduleQueue?.();
    }
    return true;
  }
  function enforce(){
    installOps();
    if(typeof window.__tuinbooksV6007RenderSchedule==='function'&&window.renderSchedule!==window.__tuinbooksV6007RenderSchedule)window.renderSchedule=window.__tuinbooksV6007RenderSchedule;
    document.body.classList.remove('v6007-basket-open');
    const drawer=document.getElementById('scheduleParkingLotV5537');if(drawer){drawer.classList.add('hidden');drawer.style.setProperty('display','none','important');}
  }
  function installStatus(){
    document.querySelectorAll('[class^="tuinbooks-canary-status-v600"]').forEach(n=>n.remove());
    const el=document.createElement('div');el.className='tuinbooks-canary-status-v6008';document.body.appendChild(el);
    const update=()=>{const state=window.state||{};el.innerHTML=`<strong>v60.0.8 UNIQUE CANARY</strong> · ${location.pathname.endsWith('consolidation-v6008.html')?'unique page YES':'WRONG PAGE'} · renderer ${document.documentElement.dataset.scheduleRenderer||'waiting'} · ${(state.schedules||[]).length} loaded jobs · ${(state.teams||[]).length} teams · ops bar ${document.getElementById('v6008ScheduleOps')?'YES':'NO'} · production index untouched`;};
    update();setInterval(update,700);
  }
  function boot(){
    document.documentElement.dataset.tuinbooksCanary='v6008';
    enforce();installStatus();
    setTimeout(()=>{try{window.__tuinbooksV6007RenderSchedule?.();}catch(e){console.error('[v6008] render',e);}enforce();},250);
    setInterval(enforce,1000);
    document.addEventListener('click',e=>{if(e.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>{try{window.__tuinbooksV6007RenderSchedule?.();}catch(_){}enforce();},80);},true);
    console.info('[TuinBooks v60.0.8 canary]',{build:BUILD,uniqueEntry:true,productionIndexUntouched:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
