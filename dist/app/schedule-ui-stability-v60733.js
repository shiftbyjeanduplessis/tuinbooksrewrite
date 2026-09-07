/* TuinBooks v60.7.33 — Schedule UI stability guard
   DOM-only, loaded last. Does not touch schedule data or persistence. */
(()=>{
  'use strict';
  const BUILD='60.7.33-schedule-layout-context-repair';

  function dragModeActive(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  function removeOnboardingShortcut(){
    const root=document.getElementById('view-schedule');
    if(!root)return;
    root.querySelectorAll('#openOnboardingMasterImportV60420,[data-open-onboarding-workbook],[data-onboarding-import-shortcut]').forEach(node=>node.remove());
    root.querySelectorAll('button,a').forEach(node=>{
      const text=String(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(text==='import onboarding workbook')node.remove();
    });
  }

  function closeBasketToTag(){
    try{document.body?.classList.remove('v6007-basket-open');}catch(_){ }
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(drawer){drawer.classList.add('hidden');drawer.innerHTML='';}
    const launcher=document.getElementById('scheduleBasketLauncherV58931');
    if(launcher){launcher.classList.remove('hidden');launcher.removeAttribute('hidden');launcher.style.removeProperty('display');launcher.style.removeProperty('visibility');}
  }

  const closeBasketBeforeV60726=typeof window.closeScheduleQueue==='function'?window.closeScheduleQueue:null;
  window.closeScheduleQueue=function closeScheduleQueueUiV60726(){
    try{closeBasketBeforeV60726?.();}catch(error){console.warn('[TuinBooks v60.7.29] basket close fallback',error);}
    closeBasketToTag();
  };
  window.closeScheduleParkingDrawerV5538=window.closeScheduleQueue;

  function managementBannerBottom(){
    const banner=document.getElementById('managementModeBannerV5936');
    if(!banner)return 0;
    const rect=banner.getBoundingClientRect();
    return rect.height>0?Math.max(0,Math.round(rect.bottom)):0;
  }

  function closeScheduleDetail(){
    try{
      if(typeof window.closeScheduleDetailV23==='function')window.closeScheduleDetailV23();
      else{
        document.getElementById('scheduleDetailPanel')?.classList.add('hidden');
        document.body?.classList.remove('schedule-zoom-open');
      }
    }catch(_){
      document.getElementById('scheduleDetailPanel')?.classList.add('hidden');
      document.body?.classList.remove('schedule-zoom-open');
    }
    syncDetailExit();
  }

  function ensureFloatingClose(){
    let button=document.getElementById('scheduleDetailFloatingCloseV60733');
    if(button)return button;
    button=document.createElement('button');
    button.id='scheduleDetailFloatingCloseV60733';
    button.type='button';
    button.className='tb-schedule-detail-floating-close-v60733';
    button.setAttribute('aria-label','Close visit details');
    button.setAttribute('title','Close visit details');
    button.textContent='×';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeScheduleDetail();});
    document.body.appendChild(button);
    return button;
  }

  function syncDetailExit(){
    const panel=document.getElementById('scheduleDetailPanel');
    const open=!!panel&&!panel.classList.contains('hidden');
    const button=ensureFloatingClose();
    button.hidden=!open;
    if(!open)return;
    const top=Math.max(10,managementBannerBottom()+10);
    document.documentElement.style.setProperty('--tb-detail-top-v60733',`${top}px`);
    button.style.top=`${top}px`;
  }

  function installStyles(){
    if(document.getElementById('scheduleUiStabilityStylesV60733'))return;
    const style=document.createElement('style');
    style.id='scheduleUiStabilityStylesV60733';
    style.textContent=`
      /* Restore the pre-loader page positioning context. This is deliberately
         last-loaded so stale loader CSS cannot push the Schedule to page bottom. */
      .admin-main{position:static!important}
      #managementWorkspaceLoadingV60727{position:fixed!important;left:50%!important;top:118px!important;right:auto!important;bottom:auto!important;inset:auto!important;transform:translateX(-50%)!important;width:min(460px,calc(100vw - 28px))!important;min-height:0!important;padding:0!important;background:transparent!important}
      #scheduleDetailPanel:not(.hidden){
        top:var(--tb-detail-top-v60733,10px)!important;
        bottom:8px!important;
        height:auto!important;
        max-height:calc(100dvh - var(--tb-detail-top-v60733,10px) - 8px)!important;
      }
      .tb-schedule-detail-floating-close-v60733{
        position:fixed;right:16px;z-index:2147483100;width:38px;height:38px;
        display:grid;place-items:center;border:1px solid #d9e6df;border-radius:12px;
        background:#fff;color:#173f2d;font:800 24px/1 system-ui,sans-serif;
        box-shadow:0 4px 18px rgba(0,0,0,.18);cursor:pointer;
      }
      .tb-schedule-detail-floating-close-v60733[hidden]{display:none!important}
      #tuinbooksBuildMarkerV60733{
        position:fixed;right:8px;bottom:8px;z-index:2147482000;padding:4px 7px;
        border:1px solid rgba(18,63,43,.18);border-radius:7px;background:rgba(255,255,255,.94);
        color:#315b49;font:700 10px/1.1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08)
      }
    `;
    document.head.appendChild(style);
  }

  function installBuildMarker(){
    // Older layers each created their own bottom-right version badge. Remove
    // those stale badges so there is exactly one authoritative visible build.
    document.querySelectorAll('[id^="tuinbooksBuildV"],#tuinbooksBuildMarkerV60726,#tuinbooksBuildMarkerV60727,#tuinbooksBuildMarkerV60733').forEach(node=>node.remove());
    const marker=document.createElement('div');
    marker.id='tuinbooksBuildMarkerV60733';
    document.body.appendChild(marker);
    marker.textContent='BUILD v60.7.33';
    marker.title='TuinBooks production build 60.7.33';
  }

  // Drag mode is for rearranging. Suppress the card-body click that opens the
  // visit workspace; the explicit information control remains available.
  document.addEventListener('click',event=>{
    if(!dragModeActive())return;
    const card=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id]');
    if(!card)return;
    if(event.target?.closest?.('.schedule-card-info-v58931,.basket-card-info-v58931,.v59320-select-tick,button,a,input,label'))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
    const panel=document.getElementById('scheduleDetailPanel');
    if(panel&&!panel.classList.contains('hidden')){
      event.preventDefault();event.stopPropagation();closeScheduleDetail();
    }
  },true);

  function repairScheduleLayoutV60733(){
    const main=document.querySelector('.admin-main');
    if(main){
      main.style.removeProperty('position');
      main.style.removeProperty('min-height');
    }
    // Remove only stale positioning injected by failed repair attempts. Do not
    // touch dimensions/classes owned by the canonical Schedule renderer.
    ['#view-schedule','.schedule-control-room','.schedule-board-and-parking-v5537','#weeklyScheduleBoard'].forEach(selector=>{
      document.querySelectorAll(selector).forEach(node=>{
        if(node.style.position==='absolute')node.style.removeProperty('position');
        if(node.style.top)node.style.removeProperty('top');
        if(node.style.bottom)node.style.removeProperty('bottom');
      });
    });
  }

  function installObservers(){
    const schedule=document.getElementById('view-schedule');
    if(schedule){
      const scheduleObserver=new MutationObserver(()=>{removeOnboardingShortcut();syncDetailExit();});
      scheduleObserver.observe(schedule,{childList:true,subtree:true});
    }
    const panel=document.getElementById('scheduleDetailPanel');
    if(panel){
      const panelObserver=new MutationObserver(syncDetailExit);
      panelObserver.observe(panel,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    }
  }

  installStyles();
  repairScheduleLayoutV60733();
  removeOnboardingShortcut();
  installBuildMarker();
  ensureFloatingClose();
  syncDetailExit();
  installObservers();
  window.addEventListener('resize',()=>{repairScheduleLayoutV60733();syncDetailExit();},{passive:true});
  window.addEventListener('orientationchange',syncDetailExit,{passive:true});
  window.__tuinbooksProductionStabilityV60733={build:BUILD,closeScheduleDetail,removeOnboardingShortcut,repairScheduleLayoutV60733};
  window.__tuinbooksBuild=BUILD;
})();

window.__TUINBOOKS_RELEASE__='60.7.33';
