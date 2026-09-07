/* TuinBooks v60.7.41 — Schedule basket direct-state authority
   Scope: Schedule UI only. No Supabase writes, no Work/Billing/Management changes.
   Loaded last by app/index.html.

   Fixes:
   - removes the Schedule "Import onboarding workbook" entry without fighting the
     onboarding observer (a hidden sentinel keeps the legacy observer satisfied)
   - makes Rearrange / Drag mode always render the real high-density Basket on LEFT
   - removes the obsolete fixed/overlay basket geometry and reserved blank gutter
   - makes the full week fit the available board width in Rearrange mode
   - removes the stray horizontal page/calendar scrollbar in Rearrange mode
   - makes the standard green Basket strip open the canonical Basket directly
*/
(()=>{
  'use strict';

  const BUILD='60.7.41-schedule-basket-direct-state-authority';
  let syncQueued=false;
  let syncing=false;

  function dragModeActive(){
    const body=document.body;
    return !!body && (
      body.classList.contains('schedule-drag-mode-active-v6061') ||
      body.classList.contains('schedule-drag-mode-active-v6059')
    );
  }

  function ensureOnboardingSentinel(){
    const root=document.getElementById('view-schedule');
    if(!root)return;

    // Remove every visible Schedule onboarding shortcut first.
    root.querySelectorAll('[data-open-onboarding-workbook],[data-onboarding-import-shortcut]').forEach(node=>node.remove());
    root.querySelectorAll('button,a').forEach(node=>{
      const text=String(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(text==='import onboarding workbook' && node.id!=='openScheduleOnboardingMasterImportV60420'){
        node.closest('.onboarding-import-entry-v60420')?.remove();
        node.remove?.();
      }
    });

    // onboarding-master-import-v60423 observes Schedule and recreates the button
    // whenever the expected ID disappears. Keep one invisible sentinel so that
    // observer has nothing to recreate. It is never displayed or keyboard-focusable.
    let button=document.getElementById('openScheduleOnboardingMasterImportV60420');
    let bar=button?.closest?.('.onboarding-import-entry-v60420')||null;

    if(!button){
      bar=document.createElement('div');
      bar.className='onboarding-import-entry-v60420 tuinbooks-schedule-onboarding-sentinel-v60741';
      bar.hidden=true;
      button=document.createElement('button');
      button.type='button';
      button.id='openScheduleOnboardingMasterImportV60420';
      button.tabIndex=-1;
      button.setAttribute('aria-hidden','true');
      button.textContent='Import onboarding workbook';
      bar.appendChild(button);
      root.insertBefore(bar,root.firstChild);
    }

    if(bar){
      bar.hidden=true;
      bar.setAttribute('aria-hidden','true');
      bar.classList.add('tuinbooks-schedule-onboarding-sentinel-v60741');
    }
    if(button){
      button.tabIndex=-1;
      button.setAttribute('aria-hidden','true');
    }

    // Remove duplicate wrappers the historical observer may have created.
    root.querySelectorAll(':scope > .onboarding-import-entry-v60420').forEach(node=>{
      if(node!==bar)node.remove();
    });
  }

  function basketRendered(drawer){
    return !!drawer?.querySelector?.('.schedule-basket-body-v58931');
  }

  function directBasketRender(open,{drag=false}={}){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    const launcher=document.getElementById('scheduleBasketLauncherV58931');
    if(!drawer)return false;

    // app.js keeps Schedule basket state in top-level lexical bindings rather than
    // window properties. Late wrapper chains can therefore drift away from the
    // actual state. This final Schedule authority talks to those live bindings
    // directly and calls the canonical renderer directly.
    try{
      if(typeof scheduleQueueOpen!=='undefined')scheduleQueueOpen=!!open;
      if(typeof scheduleBasketMinimisedV58931!=='undefined')scheduleBasketMinimisedV58931=false;
      if(typeof renderScheduleQueue==='function')renderScheduleQueue();
      else throw new Error('Canonical renderScheduleQueue binding is unavailable');
    }catch(error){
      console.error('[TuinBooks v60.7.41] direct Basket render failed',error);
      drawer.classList.add('hidden');
      if(!drag && launcher){
        launcher.classList.remove('hidden');
        launcher.removeAttribute('aria-hidden');
      }
      return false;
    }

    if(open){
      document.body?.classList.add('v6007-basket-open');
      drawer.classList.remove('hidden','minimised-v58931');
      drawer.removeAttribute('hidden');
      drawer.setAttribute('aria-hidden','false');
      if(launcher){
        launcher.classList.add('hidden');
        launcher.setAttribute('aria-hidden','true');
      }
    }else{
      document.body?.classList.remove('v6007-basket-open');
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden','true');
      if(launcher){
        launcher.classList.remove('hidden');
        launcher.removeAttribute('hidden');
        launcher.removeAttribute('aria-hidden');
        launcher.style.pointerEvents='auto';
      }
    }

    const ready=!open || basketRendered(drawer);
    if(open && !ready){
      console.error('[TuinBooks v60.7.41] Basket opened but canonical content was not rendered');
      return false;
    }
    return ready;
  }

  // One final Schedule basket API. Historical scripts may have captured older
  // wrappers, but all future UI actions now land here.
  window.openScheduleQueue=function openScheduleQueueV60741(){
    return directBasketRender(true,{drag:dragModeActive()});
  };
  window.closeScheduleQueue=function closeScheduleQueueV60741(){
    return directBasketRender(false,{drag:false});
  };
  window.openScheduleParkingDrawerV5538=window.openScheduleQueue;
  window.closeScheduleParkingDrawerV5538=window.closeScheduleQueue;

  function ensureBasketOpenForRearrange(){
    if(!dragModeActive())return;
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(!drawer)return;

    document.body?.classList.add('v60741-rearrange-authority');

    // Render from the real app state only when the drawer was cleared/closed.
    // Once canonical content exists, merely keep the existing drawer visible.
    // This avoids a MutationObserver render loop.
    const needsRender=!basketRendered(drawer) || drawer.classList.contains('hidden');
    if(needsRender && !directBasketRender(true,{drag:true}))return;

    drawer.dataset.v60741Ready='1';
    drawer.classList.remove('hidden','minimised-v58931');
    drawer.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden','false');
    document.body?.classList.add('v6007-basket-open');
  }

  function openStandardBasket(){
    if(dragModeActive())return ensureBasketOpenForRearrange();
    return directBasketRender(true,{drag:false});
  }

  function leaveRearrangeLayout(){
    document.body?.classList.remove('v60741-rearrange-authority');
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(drawer)delete drawer.dataset.v60741Ready;
    const launcher=document.getElementById('scheduleBasketLauncherV58931');
    if(launcher){launcher.removeAttribute('aria-hidden');launcher.style.pointerEvents='auto';}
    // Normal Schedule basket state is deliberately left to the existing controls.
  }

  function sync(){
    syncQueued=false;
    if(syncing)return;
    syncing=true;
    try{
      ensureOnboardingSentinel();
      if(dragModeActive()){
        ensureBasketOpenForRearrange();
      }else{
        leaveRearrangeLayout();
        // Reconcile standard Basket/launcher from the real state without forcing
        // it closed. This also repairs a stale launcher after leaving Rearrange.
        let open=false;
        try{open=typeof scheduleQueueOpen!=='undefined'&&!!scheduleQueueOpen;}catch(_){ }
        const drawer=document.getElementById('scheduleParkingLotV5537');
        const launcher=document.getElementById('scheduleBasketLauncherV58931');
        if(open){
          if(!basketRendered(drawer)||drawer?.classList.contains('hidden'))directBasketRender(true,{drag:false});
        }else{
          const staleDrawer=!!drawer && !drawer.classList.contains('hidden');
          const staleLauncher=!!launcher && launcher.classList.contains('hidden');
          if(staleDrawer||staleLauncher)directBasketRender(false,{drag:false});
        }
      }
    }finally{
      syncing=false;
    }
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(sync);
  }

  function installStyles(){
    if(document.getElementById('scheduleRuntimeAuthorityStylesV60740'))return;
    const style=document.createElement('style');
    style.id='scheduleRuntimeAuthorityStylesV60740';
    style.textContent=`
      /* Schedule onboarding shortcut is intentionally retired from Schedule. */
      #view-schedule>.onboarding-import-entry-v60420,
      #view-schedule #openScheduleOnboardingMasterImportV60420,
      #view-schedule [data-open-onboarding-workbook],
      #view-schedule [data-onboarding-import-shortcut]{
        display:none!important;
        width:0!important;height:0!important;min-height:0!important;
        margin:0!important;padding:0!important;border:0!important;
        overflow:hidden!important;pointer-events:none!important;
      }

      /* Retired toolbar must never reserve space above the real calendar. */
      #view-schedule #scheduleToolbarV6006{
        display:none!important;height:0!important;min-height:0!important;
        margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;
      }

      /* ------------------------------------------------------------
         REARRANGE MODE — one predictable two-column workspace
         Basket left, full week right. Nothing fixed over the page.
         ------------------------------------------------------------ */
      body.v60741-rearrange-authority #view-schedule{
        max-width:none!important;
        overflow:visible!important;
      }
      body.v60741-rearrange-authority #view-schedule .schedule-control-room{
        display:block!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        overflow:visible!important;
      }
      body.v60741-rearrange-authority #view-schedule .schedule-board-and-parking-v5537{
        display:grid!important;
        grid-template-columns:clamp(310px,27vw,350px) minmax(0,1fr)!important;
        grid-template-rows:auto!important;
        gap:10px!important;
        align-items:start!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        margin:0!important;
        padding:0!important;
        overflow:visible!important;
      }

      /* Calendar is explicitly the RIGHT column. */
      body.v60741-rearrange-authority #weeklyScheduleBoard{
        grid-column:2!important;
        grid-row:1!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        margin:0!important;
        overflow:hidden!important;
      }
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-board-scroll{
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        overflow-x:hidden!important;
        overflow-y:visible!important;
        padding-bottom:0!important;
        scrollbar-width:none!important;
      }
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-board-scroll::-webkit-scrollbar{
        display:none!important;
      }

      /* The normal calendar enforces a 1180–1218px minimum width. That is useful
         in detail mode but causes the strange bottom scroller in Rearrange mode.
         Fit the full week to the remaining width instead. */
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-grid-clean{
        display:grid!important;
        grid-template-columns:86px repeat(var(--day-count),minmax(0,1fr))!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        overflow:visible!important;
      }
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-grid-corner,
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-day-heading,
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-team-heading,
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-day-lane{
        min-width:0!important;
        box-sizing:border-box!important;
      }
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-team-heading{
        left:0!important;
      }
      body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-card-clean{
        max-width:100%!important;
        min-width:0!important;
      }

      /* Basket is explicitly the LEFT column and stays in normal document flow.
         This replaces the old fixed-overlay + fake left padding arrangement. */
      body.v60741-rearrange-authority #scheduleParkingLotV5537.schedule-basket-panel-v58930,
      body.v60741-rearrange-authority #scheduleParkingLotV5537.schedule-basket-panel-v58930.floating-v58931,
      body.v60741-rearrange-authority #scheduleParkingLotV5537.schedule-basket-panel-v58930.minimised-v58931{
        display:flex!important;
        grid-column:1!important;
        grid-row:1!important;
        position:relative!important;
        left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
        transform:none!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        height:min(620px,calc(100vh - 290px))!important;
        min-height:430px!important;
        max-height:620px!important;
        margin:0!important;
        padding:0!important;
        border-radius:14px!important;
        overflow:hidden!important;
        z-index:10!important;
        box-shadow:0 8px 24px rgba(18,57,44,.12)!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-head-v58930{
        flex:0 0 auto!important;
        padding:7px 9px!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-head-v58930 .eyebrow,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-head-v58930 p,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-window-actions-v58931{
        display:none!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-head-v58930 h2{
        margin:0!important;
        font-size:.86rem!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-body-v58931{
        display:flex!important;
        flex-direction:column!important;
        flex:1 1 auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        gap:2px!important;
        padding:4px 6px 6px!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-drop-hint-v58930{
        padding:4px 6px!important;
        font-size:.58rem!important;
        line-height:1.05!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .control{
        min-height:24px!important;
        padding:3px 6px!important;
        font-size:.59rem!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-groups-v58930,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-group-v58930,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-group-v58930>div{
        gap:2px!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-group-v58930>header{
        min-height:14px!important;
        padding:0 1px!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-group-v58930>header strong{
        font-size:.58rem!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-group-v58930>header small{
        display:none!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .schedule-basket-card-v58930{
        display:grid!important;
        grid-template-columns:14px minmax(0,1fr) 10px!important;
        align-items:center!important;
        min-height:19px!important;
        padding:1px 4px!important;
        gap:3px!important;
        border-radius:5px!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930>div:first-child{
        display:block!important;
        min-width:0!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930 strong{
        display:block!important;
        font-size:.62rem!important;
        line-height:1!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930 small,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930 p,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-main-v58930 .ui-pill,
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .basket-card-info-v58931{
        display:none!important;
      }
      body.v60741-rearrange-authority #scheduleParkingLotV5537 .queue-work-marker{
        width:12px!important;height:12px!important;min-width:12px!important;font-size:.46rem!important;
      }
      body.v60741-rearrange-authority #scheduleBasketLauncherV58931{
        display:none!important;
      }

      /* Keep drag controls and week controls on one clean row. */
      body.v60741-rearrange-authority #view-schedule .rolling-plan-panel{
        margin-bottom:8px!important;
      }
      body.v60741-rearrange-authority #view-schedule .v6059-schedule-nav{
        width:100%!important;
        min-width:0!important;
      }

      /* Narrow screens: still no overlay. Stack Basket above the board. */
      @media(max-width:900px){
        body.v60741-rearrange-authority #view-schedule .schedule-board-and-parking-v5537{
          grid-template-columns:minmax(0,1fr)!important;
        }
        body.v60741-rearrange-authority #scheduleParkingLotV5537.schedule-basket-panel-v58930{
          grid-column:1!important;grid-row:1!important;
          height:360px!important;min-height:300px!important;max-height:360px!important;
        }
        body.v60741-rearrange-authority #weeklyScheduleBoard{
          grid-column:1!important;grid-row:2!important;
        }
        body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-grid-clean{
          grid-template-columns:78px repeat(var(--day-count),minmax(92px,1fr))!important;
          min-width:720px!important;
        }
        body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-board-scroll{
          overflow-x:auto!important;
          scrollbar-width:thin!important;
        }
        body.v60741-rearrange-authority #weeklyScheduleBoard .schedule-board-scroll::-webkit-scrollbar{
          display:block!important;height:8px!important;
        }
      }


      /* Standard Schedule: the green Basket strip must remain clickable and the
         canonical floating basket must be allowed to display when opened. */
      body:not(.schedule-drag-mode-active-v6061):not(.schedule-drag-mode-active-v6059)
      #scheduleBasketLauncherV58931.schedule-basket-launcher-v58931:not(.hidden){
        display:flex!important;
        pointer-events:auto!important;
        cursor:pointer!important;
      }
      body.v6007-basket-open:not(.schedule-drag-mode-active-v6061):not(.schedule-drag-mode-active-v6059)
      #scheduleParkingLotV5537:not(.hidden){
        display:block!important;
      }
      body.v6007-basket-open #scheduleBasketLauncherV58931{
        display:none!important;
      }

      #tuinbooksBuildMarkerV60740{
        position:fixed;right:8px;bottom:8px;z-index:2147482000;
        padding:4px 7px;border:1px solid rgba(18,63,43,.18);border-radius:7px;
        background:rgba(255,255,255,.94);color:#315b49;
        font:700 10px/1.1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08)
      }
    `;
    document.head.appendChild(style);
  }

  function installMarker(){
    document.querySelectorAll('[id^="tuinbooksBuildMarkerV"]').forEach(node=>node.remove());
    const marker=document.createElement('div');
    marker.id='tuinbooksBuildMarkerV60740';
    marker.textContent='BUILD v60.7.41';
    marker.title='TuinBooks Schedule basket repair v60.7.41';
    document.body?.appendChild(marker);
  }

  function installObserver(){
    const target=document.getElementById('view-schedule')||document.documentElement;
    if(target.__tuinbooksScheduleRuntimeAuthorityObserverV60740)return;
    const observer=new MutationObserver(queueSync);
    observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    target.__tuinbooksScheduleRuntimeAuthorityObserverV60740=observer;
  }

  function installBasketAuthority(){
    if(document.documentElement.__tuinbooksBasketAuthorityV60740)return;
    document.documentElement.__tuinbooksBasketAuthorityV60740=true;

    // The inline onclick on the green strip has crossed several generations of
    // openScheduleQueue wrappers. Own this one click at the final loaded layer.
    document.addEventListener('click',event=>{
      const launcher=event.target?.closest?.('#scheduleBasketLauncherV58931');
      if(!launcher)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openStandardBasket();
    },true);

    // Any Schedule render can rebuild/clear the basket DOM. Re-assert the basket
    // only after that canonical render completes, instead of showing a blank box.
    const base=window.renderSchedule;
    if(typeof base==='function'&&!base.__v60741BasketWrapped){
      const wrapped=function(...args){
        const result=base.apply(this,args);
        setTimeout(queueSync,0);
        return result;
      };
      wrapped.__v60741BasketWrapped=true;
      window.renderSchedule=wrapped;
    }
  }

  function boot(){
    installStyles();
    installBasketAuthority();
    installMarker();
    installObserver();
    sync();
    // A Schedule render can be queued after DOMContentLoaded/runtime hydration.
    setTimeout(sync,80);
    setTimeout(sync,350);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.__tuinbooksScheduleRuntimeAuthorityV60740={build:BUILD,sync,ensureBasket:ensureBasketOpenForRearrange,openBasket:openStandardBasket};
  window.__tuinbooksBuild=BUILD;
  window.__TUINBOOKS_RELEASE__='60.7.41';
})();
