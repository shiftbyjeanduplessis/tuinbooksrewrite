/* TuinBooks v60.7.34 — Schedule authority + Basket state repair
   Loaded last. Schedule UI only; no data writes and no Supabase changes. */
(()=>{
  'use strict';
  const BUILD='60.7.34-schedule-authority-repair';
  let renderTimer=0;
  let aliasAdded=false;
  let closingBasket=false;

  function dragModeActive(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  // v60.6.6 styling is keyed to the v6061 class, while older installs can
  // still activate v6059. Mirror the class only while needed; do not alter data.
  function syncDragModeAlias(){
    const body=document.body;if(!body)return;
    const oldActive=body.classList.contains('schedule-drag-mode-active-v6059');
    const newActive=body.classList.contains('schedule-drag-mode-active-v6061');
    if(oldActive&&!newActive){body.classList.add('schedule-drag-mode-active-v6061');aliasAdded=true;return;}
    if(!oldActive&&aliasAdded){body.classList.remove('schedule-drag-mode-active-v6061');aliasAdded=false;}
  }

  function removeOnboardingShortcut(){
    const root=document.getElementById('view-schedule');if(!root)return;
    root.querySelectorAll('#openOnboardingMasterImportV60420,[data-open-onboarding-workbook],[data-onboarding-import-shortcut]').forEach(node=>node.remove());
    root.querySelectorAll('button,a').forEach(node=>{
      if(String(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()==='import onboarding workbook')node.remove();
    });
  }

  function showBasketTag(){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(drawer){drawer.classList.add('hidden');drawer.classList.remove('minimised-v58931');drawer.innerHTML='';}
    const launcher=document.getElementById('scheduleBasketLauncherV58931');
    if(launcher){launcher.classList.remove('hidden');launcher.removeAttribute('hidden');launcher.style.removeProperty('display');launcher.style.removeProperty('visibility');}
    document.body?.classList.remove('v6007-basket-open');
  }

  const openBase=typeof window.openScheduleQueue==='function'?window.openScheduleQueue:null;
  const closeBase=typeof window.closeScheduleQueue==='function'?window.closeScheduleQueue:null;
  window.openScheduleQueue=function openScheduleQueueV60734(){
    const result=openBase?.();
    return result;
  };
  window.closeScheduleQueue=function closeScheduleQueueV60734(){
    if(closingBasket)return;
    closingBasket=true;
    try{closeBase?.();}catch(error){console.warn('[TuinBooks v60.7.34] Basket close fallback',error);}
    showBasketTag();
    closingBasket=false;
  };
  window.closeScheduleParkingDrawerV5538=window.closeScheduleQueue;

  function scheduleActive(){return document.getElementById('view-schedule')?.classList.contains('active');}
  function boardHasContent(){return !!document.getElementById('weeklyScheduleBoard')?.children?.length;}

  function renderScheduleNow(reason='ui'){
    if(!scheduleActive())return false;
    const board=document.getElementById('weeklyScheduleBoard');
    if(board){board.classList.remove('hidden');board.style.removeProperty('display');board.style.removeProperty('visibility');}
    const renderer=typeof window.__tuinbooksV6007RenderSchedule==='function'
      ?window.__tuinbooksV6007RenderSchedule
      :window.renderSchedule;
    if(typeof renderer!=='function')return false;
    try{
      renderer();
      if(board){board.classList.remove('hidden');board.style.removeProperty('display');board.style.removeProperty('visibility');}
      return boardHasContent();
    }catch(error){
      console.error(`[TuinBooks v60.7.34] Schedule render failed (${reason})`,error);
      return false;
    }
  }

  function ensureScheduleRendered(reason='activation'){
    clearTimeout(renderTimer);
    let tries=0;
    const attempt=()=>{
      if(!scheduleActive())return;
      tries++;
      const ok=renderScheduleNow(reason);
      // Management can finish the operational payload a few seconds after the
      // core account. Retry only while the Schedule is active and truly empty.
      if(!ok&&tries<20)renderTimer=setTimeout(attempt,350);
    };
    requestAnimationFrame(attempt);
  }

  function managementBannerBottom(){
    const banner=document.getElementById('managementModeBannerV5936');
    if(!banner)return 0;
    const rect=banner.getBoundingClientRect();return rect.height>0?Math.max(0,Math.round(rect.bottom)):0;
  }
  function closeScheduleDetail(){
    try{if(typeof window.closeScheduleDetailV23==='function')window.closeScheduleDetailV23();else document.getElementById('scheduleDetailPanel')?.classList.add('hidden');}
    catch(_){document.getElementById('scheduleDetailPanel')?.classList.add('hidden');}
    syncDetailClose();
  }
  function ensureFloatingClose(){
    let button=document.getElementById('scheduleDetailFloatingCloseV60734');
    if(button)return button;
    button=document.createElement('button');button.id='scheduleDetailFloatingCloseV60734';button.type='button';button.className='tb-schedule-detail-floating-close-v60734';button.textContent='×';button.setAttribute('aria-label','Close visit details');button.title='Close visit details';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeScheduleDetail();});
    document.body.appendChild(button);return button;
  }
  function syncDetailClose(){
    const panel=document.getElementById('scheduleDetailPanel'),open=!!panel&&!panel.classList.contains('hidden'),button=ensureFloatingClose();
    button.hidden=!open;if(!open)return;
    button.style.top=`${Math.max(10,managementBannerBottom()+10)}px`;
  }

  function installStyles(){
    if(document.getElementById('scheduleUiStabilityStylesV60734'))return;
    const style=document.createElement('style');style.id='scheduleUiStabilityStylesV60734';
    style.textContent=`
      /* No Schedule geometry overrides here. The canonical renderer/CSS owns layout. */
      .tb-schedule-detail-floating-close-v60734{position:fixed;right:16px;z-index:2147483100;width:38px;height:38px;display:grid;place-items:center;border:1px solid #d9e6df;border-radius:12px;background:#fff;color:#173f2d;font:800 24px/1 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.18);cursor:pointer}
      .tb-schedule-detail-floating-close-v60734[hidden]{display:none!important}
      #tuinbooksBuildMarkerV60734{position:fixed;right:8px;bottom:8px;z-index:2147482000;padding:4px 7px;border:1px solid rgba(18,63,43,.18);border-radius:7px;background:rgba(255,255,255,.94);color:#315b49;font:700 10px/1.1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    `;
    document.head.appendChild(style);
  }

  function installBuildMarker(){
    document.querySelectorAll('[id^="tuinbooksBuildV"],[id^="tuinbooksBuildMarkerV"]').forEach(node=>node.remove());
    const marker=document.createElement('div');marker.id='tuinbooksBuildMarkerV60734';marker.textContent='BUILD v60.7.34';marker.title='TuinBooks production build 60.7.34';document.body.appendChild(marker);
  }

  // In Drag Mode, card-body clicks are moves/selections, not detail navigation.
  document.addEventListener('click',event=>{
    const nav=event.target?.closest?.('.nav-tab[data-view="schedule"]');
    if(nav)setTimeout(()=>ensureScheduleRendered('schedule-tab'),0);

    if(!dragModeActive())return;
    const card=event.target?.closest?.('#weeklyScheduleBoard [data-job-id]');
    if(!card)return;
    if(event.target?.closest?.('button,a,input,label,.schedule-card-info-v58931,.basket-card-info-v58931,.v59320-select-tick'))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
    const panel=document.getElementById('scheduleDetailPanel');
    if(panel&&!panel.classList.contains('hidden')){event.preventDefault();event.stopPropagation();closeScheduleDetail();}
  },true);

  function installObservers(){
    const schedule=document.getElementById('view-schedule');
    if(schedule){
      let wasActive=schedule.classList.contains('active');
      new MutationObserver(()=>{
        removeOnboardingShortcut();syncDragModeAlias();syncDetailClose();
        const active=schedule.classList.contains('active');
        if(active&&!wasActive)ensureScheduleRendered('view-activated');
        wasActive=active;
      }).observe(schedule,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    }
    if(document.body)new MutationObserver(syncDragModeAlias).observe(document.body,{attributes:true,attributeFilter:['class']});
    const panel=document.getElementById('scheduleDetailPanel');if(panel)new MutationObserver(syncDetailClose).observe(panel,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }

  installStyles();removeOnboardingShortcut();installBuildMarker();syncDragModeAlias();syncDetailClose();installObservers();
  if(scheduleActive())ensureScheduleRendered('boot');
  window.addEventListener('resize',syncDetailClose,{passive:true});
  window.__tuinbooksScheduleAuthorityV60734={build:BUILD,ensureScheduleRendered,renderScheduleNow};
  window.__tuinbooksBuild=BUILD;
  window.__TUINBOOKS_RELEASE__='60.7.34';
})();
