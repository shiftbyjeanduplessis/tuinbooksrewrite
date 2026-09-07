/* TuinBooks v60.7.38 — Schedule runtime authority + Settings access cleanup
   Loaded last. UI-only: no Supabase writes and no schedule data mutation.
   Purpose:
   - retire the orphan v6006 Schedule toolbar that can reserve a huge blank block
   - stop late hotfix code from invoking an older Schedule renderer
   - make Basket close authoritative by returning the legacy schedule subtab to calendar
*/
(()=>{
  'use strict';
  const BUILD='60.7.38-schedule-basket-state-fix';
  let aliasAdded=false;
  let closingBasket=false;
  let basketOpen=false;
  let syncingBasket=false;

  function dragModeActive(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  function syncDragModeAlias(){
    const body=document.body;if(!body)return;
    const oldActive=body.classList.contains('schedule-drag-mode-active-v6059');
    const newActive=body.classList.contains('schedule-drag-mode-active-v6061');
    if(oldActive&&!newActive){body.classList.add('schedule-drag-mode-active-v6061');aliasAdded=true;return;}
    if(!oldActive&&aliasAdded){body.classList.remove('schedule-drag-mode-active-v6061');aliasAdded=false;}
  }

  function removeRetiredScheduleChrome(){
    // v6006 inserts this before rollingScheduleOverview. On the current production
    // renderer it is obsolete; if legacy CSS sizes it incorrectly it can reserve
    // tens of thousands of pixels above the real calendar.
    document.getElementById('scheduleToolbarV6006')?.remove();
    const root=document.getElementById('view-schedule');if(!root)return;
    // Keep one hidden importer sentinel. Deleting its button makes the
    // onboarding observer recreate another wrapper on every Schedule mutation.
    const onboardingBars=[...root.querySelectorAll(':scope > .onboarding-import-entry-v60420')];
    const keeper=onboardingBars.find(bar=>bar.querySelector('#openScheduleOnboardingMasterImportV60420'))||null;
    onboardingBars.forEach(bar=>{if(bar!==keeper)bar.remove();});
    if(keeper){
      keeper.hidden=true;
      keeper.setAttribute('aria-hidden','true');
      keeper.style.setProperty('display','none','important');
      keeper.style.setProperty('margin','0','important');
      keeper.style.setProperty('height','0','important');
    }
    root.querySelectorAll('[data-open-onboarding-workbook],[data-onboarding-import-shortcut]').forEach(node=>node.remove());
  }

  function showBasketTag(){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(drawer){drawer.classList.add('hidden');drawer.classList.remove('minimised-v58931');drawer.innerHTML='';}
    const launcher=document.getElementById('scheduleBasketLauncherV58931');
    if(launcher){launcher.classList.remove('hidden');launcher.removeAttribute('hidden');launcher.style.removeProperty('display');launcher.style.removeProperty('visibility');}
    document.body?.classList.remove('v6007-basket-open');
  }

  function showBasketDrawer(){
    if(syncingBasket)return;
    syncingBasket=true;
    try{
      try{openBase?.();}catch(error){console.warn('[TuinBooks v60.7.38] Basket open fallback',error);}
      const drawer=document.getElementById('scheduleParkingLotV5537');
      if(drawer){drawer.classList.remove('hidden');drawer.removeAttribute('hidden');}
      const launcher=document.getElementById('scheduleBasketLauncherV58931');
      if(launcher)launcher.classList.add('hidden');
      document.body?.classList.add('v6007-basket-open');
    }finally{
      queueMicrotask(()=>{syncingBasket=false;});
    }
  }

  function syncBasketState(){
    if(basketOpen)showBasketDrawer();
    else showBasketTag();
  }

  function basketStateNeedsSync(){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    const bodyOpen=!!document.body?.classList.contains('v6007-basket-open');
    if(basketOpen)return !bodyOpen||!drawer||drawer.classList.contains('hidden');
    return bodyOpen||!!drawer&&!drawer.classList.contains('hidden');
  }

  function forceCalendarSubtab(){
    // This is the missing half of Basket close. The old subtab state can remain
    // "basket", and the next Schedule render then reopens the full drawer.
    try{window.applyScheduleTabV58930?.('calendar');}catch(_){ }
  }

  const openBase=typeof window.openScheduleQueue==='function'?window.openScheduleQueue:null;
  const closeBase=typeof window.closeScheduleQueue==='function'?window.closeScheduleQueue:null;

  window.openScheduleQueue=function openScheduleQueueV60735(){
    basketOpen=true;
    showBasketDrawer();
    setTimeout(syncBasketState,80);
    setTimeout(syncBasketState,400);
  };

  window.closeScheduleQueue=function closeScheduleQueueV60735(){
    if(closingBasket)return;
    closingBasket=true;
    basketOpen=false;
    try{
      forceCalendarSubtab();
      try{closeBase?.();}catch(error){console.warn('[TuinBooks v60.7.35] Basket close fallback',error);}
      showBasketTag();
      // A render can be queued in the same task. Reassert the closed state after it.
      queueMicrotask(()=>{forceCalendarSubtab();showBasketTag();});
      setTimeout(()=>{forceCalendarSubtab();showBasketTag();},80);
    }finally{
      closingBasket=false;
    }
  };
  window.closeScheduleParkingDrawerV5538=window.closeScheduleQueue;

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
    let button=document.getElementById('scheduleDetailFloatingCloseV60735');
    if(button)return button;
    button=document.createElement('button');
    button.id='scheduleDetailFloatingCloseV60735';button.type='button';button.className='tb-schedule-detail-floating-close-v60735';button.textContent='×';
    button.setAttribute('aria-label','Close visit details');button.title='Close visit details';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeScheduleDetail();});
    document.body.appendChild(button);return button;
  }

  function syncDetailClose(){
    const panel=document.getElementById('scheduleDetailPanel'),open=!!panel&&!panel.classList.contains('hidden'),button=ensureFloatingClose();
    button.hidden=!open;if(!open)return;
    button.style.top=`${Math.max(10,managementBannerBottom()+10)}px`;
  }

  function installStyles(){
    if(document.getElementById('scheduleUiStabilityStylesV60735'))return;
    const style=document.createElement('style');style.id='scheduleUiStabilityStylesV60735';
    style.textContent=`
      /* Retired v6006 toolbar must never participate in layout. */
      #view-schedule #scheduleToolbarV6006{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
      #view-schedule>.onboarding-import-entry-v60420{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
      body.v6007-basket-open #scheduleParkingLotV5537:not(.hidden){display:block!important}
      body.v6007-basket-open #scheduleBasketLauncherV58931{display:none!important}
      .tb-schedule-detail-floating-close-v60735{position:fixed;right:16px;z-index:2147483100;width:38px;height:38px;display:grid;place-items:center;border:1px solid #d9e6df;border-radius:12px;background:#fff;color:#173f2d;font:800 24px/1 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.18);cursor:pointer}
      .tb-schedule-detail-floating-close-v60735[hidden]{display:none!important}
      #tuinbooksBuildMarkerV60735{position:fixed;right:8px;bottom:8px;z-index:2147482000;padding:4px 7px;border:1px solid rgba(18,63,43,.18);border-radius:7px;background:rgba(255,255,255,.94);color:#315b49;font:700 10px/1.1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    `;
    document.head.appendChild(style);
  }

  function installBuildMarker(){
    document.querySelectorAll('[id^="tuinbooksBuildV"],[id^="tuinbooksBuildMarkerV"]').forEach(node=>node.remove());
    const marker=document.createElement('div');marker.id='tuinbooksBuildMarkerV60735';marker.textContent='BUILD v60.7.38';marker.title='TuinBooks production build 60.7.38';document.body.appendChild(marker);
  }

  function openSettingsAuthoritatively(){
    const view=document.getElementById('view-settings');
    if(!view)return false;
    try{window.showView?.('settings');}catch(error){console.warn('[TuinBooks v60.7.36] Settings navigation fallback',error);}
    requestAnimationFrame(()=>{
      if(view.classList.contains('active'))return;
      document.querySelectorAll('.app-view').forEach(node=>node.classList.toggle('active',node===view));
      document.querySelectorAll('.nav-tab').forEach(node=>node.classList.remove('active'));
      const button=document.getElementById('headerSettingsBtnV58930');
      button?.classList.add('active');
      try{window.renderSettings?.();}catch(error){console.error('[TuinBooks v60.7.36] Settings render failed',error);}
    });
    return true;
  }

  function installSettingsAuthority(){
    const button=document.getElementById('headerSettingsBtnV58930');
    if(!button||button.dataset.settingsAuthorityV60736==='1')return;
    button.dataset.settingsAuthorityV60736='1';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      openSettingsAuthoritatively();
    },true);
  }

  // Drag Mode: card-body clicks are moves/selections, not detail navigation.
  document.addEventListener('click',event=>{
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
      new MutationObserver(()=>{removeRetiredScheduleChrome();syncDragModeAlias();syncDetailClose();})
        .observe(schedule,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    }
    if(document.body)new MutationObserver(syncDragModeAlias).observe(document.body,{attributes:true,attributeFilter:['class']});
    const basket=document.getElementById('scheduleParkingLotV5537');
    if(basket)new MutationObserver(()=>{if(!syncingBasket&&basketStateNeedsSync())queueMicrotask(syncBasketState);}).observe(basket,{attributes:true,attributeFilter:['class','hidden'],childList:true});
    const panel=document.getElementById('scheduleDetailPanel');if(panel)new MutationObserver(syncDetailClose).observe(panel,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }

  installStyles();
  removeRetiredScheduleChrome();
  // Never inherit a half-open Basket from an interrupted earlier render.
  forceCalendarSubtab();
  try{closeBase?.();}catch(_){ }
  showBasketTag();
  installBuildMarker();
  installSettingsAuthority();
  syncDragModeAlias();
  syncDetailClose();
  installObservers();

  window.addEventListener('resize',syncDetailClose,{passive:true});
  window.__tuinbooksScheduleAuthorityV60735={build:BUILD,removeRetiredScheduleChrome,forceCalendarSubtab,openSettings:openSettingsAuthoritatively};
  window.__tuinbooksBuild=BUILD;
  window.__TUINBOOKS_RELEASE__='60.7.38';
})();
