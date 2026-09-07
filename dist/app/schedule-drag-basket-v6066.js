/* TuinBooks v60.7.42 — Drag Mode high-density staging basket + stable layout
   Loaded last. Normal Schedule remains unchanged when Drag Mode is off.
   - Docks a larger, high-density Schedule basket on the LEFT in Drag Mode.
   - Reuses the existing v59.3.20 selected-job Set without enabling duration-edit mode.
   - Calendar tickets get a small checkbox in Drag Mode.
   - Selected tickets can be sent to the basket with one action.
   - Dragging any selected ticket into the basket sends the selected group.
*/
(()=>{
  const TUINBOOKS_STAGE1_DRAGBASKET_SOURCE_V6085='60.8.5-stage1-qwen-repair';
  const BUILD='60.7.46-long-sticky-basket';
  const MULTI_MIME='application/x-tuinbooks-schedule-job-ids';
  const fallbackSelection=new Set();
  // Standard Schedule basket open/close remains owned by app.js. This module
  // only auto-opens it when Drag Mode starts and never rebinds that API.
  let lastActive=false;
  let basketAutoOpened=false;
  let syncQueued=false;

  function dragModeActive(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  function selectedSet(){
    try{
      if(typeof scheduleSelectedJobsV59320!=='undefined' && scheduleSelectedJobsV59320 instanceof Set){
        return scheduleSelectedJobsV59320;
      }
    }catch(_){ }
    return fallbackSelection;
  }

  function toastSafe(message,type=''){
    try{window.toast?.(message,type);}catch(_){ }
  }

  function movableCards(){
    try{return [...document.querySelectorAll('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart], #weeklyScheduleBoard .v6006-job[data-job-id][ondragstart]')];}
    catch(_){return [];}
  }

  function visibleMovableIds(){
    return movableCards().map(card=>String(card.dataset.jobId||'')).filter(Boolean);
  }

  function clearSelection({quiet=false}={}){
    selectedSet().clear();
    syncCardSelectors();
    if(dragModeActive())ensureBulkTools();
    if(!quiet)toastSafe('Selection cleared.');
  }

  function selectAllShown(){
    const set=selectedSet();
    visibleMovableIds().forEach(id=>set.add(id));
    syncSelectionUi();
  }

  function toggleSelected(jobId){
    if(!jobId)return;
    const set=selectedSet();
    if(set.has(jobId))set.delete(jobId);else set.add(jobId);
    syncSelectionUi();
  }

  function pruneSelection(){
    if(!dragModeActive())return;
    const visible=new Set(visibleMovableIds());
    const set=selectedSet();
    [...set].forEach(id=>{if(!visible.has(String(id)))set.delete(id);});
  }

  function syncCardSelectors(){
    const set=selectedSet();
    movableCards().forEach(card=>{
      const id=String(card.dataset.jobId||'');
      let tick=card.querySelector('.v59320-select-tick');
      if(!tick && card.classList.contains('v6006-job')){
        tick=document.createElement('span');
        tick.className='v59320-select-tick';
        tick.textContent='✓';
        card.appendChild(tick);
      }
      const selected=set.has(id);
      card.classList.toggle('v6065-multi-selected',selected);
      card.classList.toggle('v59320-selected',selected);
      card.setAttribute('aria-selected',selected?'true':'false');
      if(tick){
        tick.setAttribute('role','checkbox');
        tick.setAttribute('tabindex','0');
        tick.setAttribute('aria-checked',selected?'true':'false');
        tick.setAttribute('aria-label',`${selected?'Deselect':'Select'} this booking`);
        tick.setAttribute('title',`${selected?'Deselect':'Select'} this booking`);
      }
    });
  }

  function bulkToolsMarkup(){
    const count=selectedSet().size;
    const shown=visibleMovableIds().length;
    return `<div class="v6065-bulk-tools" data-v6065-bulk-tools>
      <div class="v6065-bulk-count"><strong>${count}</strong><span>selected</span></div>
      <button type="button" class="button secondary compact" data-v6065-select-all ${shown?'':'disabled'}>Select all shown</button>
      <button type="button" class="button secondary compact" data-v6065-clear ${count?'':'disabled'}>Clear</button>
      <button type="button" class="button compact v6065-send-basket" data-v6065-send-basket ${count?'':'disabled'}>Move ${count||''} to basket</button>
    </div>`;
  }

  function ensureBulkTools(){
    if(!dragModeActive())return;
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(!drawer||drawer.classList.contains('hidden'))return;
    const body=drawer.querySelector('.schedule-basket-body-v58931');
    if(!body)return;
    let tools=body.querySelector('[data-v6065-bulk-tools]');
    const count=selectedSet().size;
    const shown=visibleMovableIds().length;
    if(!tools){
      body.insertAdjacentHTML('afterbegin',bulkToolsMarkup());
      tools=body.querySelector('[data-v6065-bulk-tools]');
    }
    if(tools){
      const countNode=tools.querySelector('.v6065-bulk-count strong');
      if(countNode&&countNode.textContent!==String(count))countNode.textContent=String(count);
      const selectAll=tools.querySelector('[data-v6065-select-all]');
      if(selectAll&&selectAll.disabled===Boolean(shown))selectAll.disabled=!shown;
      const clear=tools.querySelector('[data-v6065-clear]');
      if(clear&&clear.disabled===Boolean(count))clear.disabled=!count;
      const send=tools.querySelector('[data-v6065-send-basket]');
      if(send){
        if(send.disabled===Boolean(count))send.disabled=!count;
        const label=`Move ${count||''} to basket`;
        if(send.textContent!==label)send.textContent=label;
      }
    }
    const hint=body.querySelector('.schedule-basket-drop-hint-v58930');
    const hintText=count>1
      ?`Drop a selected booking here to move all ${count} selected bookings`
      :'Drop bookings here to temporarily remove them from the calendar';
    if(hint&&hint.textContent!==hintText)hint.textContent=hintText;
  }

  function syncSelectionUi(){
    if(!dragModeActive())return;
    syncCardSelectors();
    ensureBulkTools();
  }

  function syncNativeDraggableV60712(active){
    movableCards().forEach(card=>{
      card.draggable=true;card.setAttribute('draggable','true');card.classList.toggle('schedule-standard-draggable-v6085',!active);
    });
  }

  function openBasketForDragMode(){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    if(!drawer)return;
    basketAutoOpened=drawer.classList.contains('hidden') || !drawer.innerHTML.trim();
    try{window.openScheduleQueue?.();}catch(_){ }
  }

  function restoreBasketAfterDragMode(){
    if(basketAutoOpened){
      try{window.closeScheduleQueue?.();}catch(_){ }
    }
    basketAutoOpened=false;
  }

  function selectedMovableIds(preferredIds=null){
    const source=Array.isArray(preferredIds)&&preferredIds.length?preferredIds:[...selectedSet()];
    const seen=new Set();
    return source.map(String).filter(id=>{
      if(!id||seen.has(id))return false;
      seen.add(id);
      try{
        const job=(state.schedules||[]).find(row=>String(row.id)===id);
        if(!job)return false;
        const status=String(job.status||'scheduled').toLowerCase();
        if(['completed','cancelled','canceled','deferred','rescheduled','no-charge','access-failed'].includes(status))return false;
        const missed=typeof scheduleJobNeedsOfficeActionV58928==='function' && scheduleJobNeedsOfficeActionV58928(job);
        if(typeof scheduleIsPast==='function' && scheduleIsPast(String(job.date||'')) && !missed)return false;
        return true;
      }catch(_){return false;}
    });
  }

  function moveIdsToBasket(ids){
    if(!dragModeActive())return false;
    const targets=selectedMovableIds(ids);
    if(!targets.length){toastSafe('Select at least one movable booking.','error');return false;}
    try{window.openScheduleQueue?.();}catch(_){ }

    let moved=0;
    let failed=0;
    const originalToast=window.toast;
    try{
      // Existing single-item move owns all lifecycle rules. Silence its per-item
      // confirmations so a 20-booking batch produces one useful message instead.
      if(typeof originalToast==='function')window.toast=()=>{};
      for(const id of targets){
        try{
          const ok=window.moveScheduleJobToBasketV58931?.(id);
          if(ok)moved++;else failed++;
        }catch(error){console.error(error);failed++;}
      }
    }finally{
      if(typeof originalToast==='function')window.toast=originalToast;
    }

    selectedSet().clear();
    try{window.renderSchedule?.();}catch(_){ }
    try{window.renderScheduleQueue?.();}catch(_){ }
    queueSync();

    if(moved){
      const suffix=failed?` ${failed} could not be moved.`:'';
      toastSafe(`${moved} booking${moved===1?'':'s'} moved to the Schedule basket.${suffix}`,failed?'error':'');
      return true;
    }
    toastSafe('The selected bookings could not be moved.','error');
    return false;
  }

  function syncMode(){
    const active=dragModeActive();
    if(active!==lastActive){
      lastActive=active;
      if(active){
        openBasketForDragMode();
        setTimeout(()=>{queueSync();},0);
      }else{
        clearSelection({quiet:true});
        try{window.closeScheduleTransientUiV6085?.();}catch(_){}
        restoreBasketAfterDragMode();
      }
    }
    if(active){
      pruneSelection();
      syncSelectionUi();
      syncNativeDraggableV60712(true);
    }else{
      syncNativeDraggableV60712(false);
      keepDragToggleAccessibleV60710();
    }
  }

  function keepDragToggleAccessibleV60710(){
    const drawer=document.getElementById('scheduleParkingLotV5537');
    const controls=document.querySelector('#view-schedule .v6059-drag-controls');
    if(!drawer||!controls||drawer.classList.contains('hidden')||!drawer.innerHTML.trim())return;
    const basketRect=drawer.getBoundingClientRect(),controlRect=controls.getBoundingClientRect();
    const overlaps=basketRect.left<controlRect.right&&basketRect.right>controlRect.left&&basketRect.top<controlRect.bottom&&basketRect.bottom>controlRect.top;
    if(!overlaps)return;
    const safeTop=Math.min(Math.max(12,controlRect.bottom+10),Math.max(12,window.innerHeight-basketRect.height-12));
    drawer.style.top=`${Math.round(safeTop)}px`;
    drawer.style.bottom='auto';
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>{syncQueued=false;syncMode();});
  }

  function installStyles(){
    if(document.getElementById('scheduleDragBasketStylesV6065'))return;
    const style=document.createElement('style');
    style.id='scheduleDragBasketStylesV6065';
    style.textContent=`
      body.schedule-drag-mode-active-v6061{
        --v6065-basket-width:clamp(300px,25vw,340px);
      }

      /* Keep the mode controls clickable if a previously positioned floating basket overlaps them. */
      body:not(.schedule-drag-mode-active-v6061) #view-schedule .v6059-drag-controls{
        position:relative!important;
        z-index:1206!important;
      }

      /* Drag Mode gets a real staging column instead of the normal small floating basket. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-control-room{
        min-width:0!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-board-and-parking-v5537{
        box-sizing:border-box!important;
        display:grid!important;
        grid-template-columns:var(--v6065-basket-width) minmax(0,1fr)!important;
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
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard{
        grid-column:2!important;
        grid-row:1!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        margin:0!important;
        overflow:hidden!important;
      }
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-board-scroll{
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        overflow-x:hidden!important;
        overflow-y:visible!important;
        padding-bottom:0!important;
        scrollbar-width:none!important;
      }
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-board-scroll::-webkit-scrollbar{display:none!important}
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-grid-clean{
        display:grid!important;
        grid-template-columns:86px repeat(var(--day-count),minmax(0,1fr))!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        overflow:visible!important;
      }
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-grid-corner,
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-day-heading,
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-team-heading,
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-day-lane{
        min-width:0!important;
        box-sizing:border-box!important;
      }
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-team-heading{left:0!important}
      body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-card-clean{max-width:100%!important;min-width:0!important}
      /* The basket uses the canonical renderer/open state. Layout only: never
         force a hidden or empty basket visible. */
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537.schedule-basket-panel-v58930.floating-v58931.hidden{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537.schedule-basket-panel-v58930.floating-v58931:not(.hidden){
        display:flex!important;
        flex-direction:column!important;
        grid-column:1!important;
        grid-row:1!important;
        position:sticky!important;
        align-self:start!important;
        left:auto!important;
        right:auto!important;
        top:10px!important;
        bottom:auto!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        height:calc(100vh - 20px)!important;
        min-height:520px!important;
        max-height:calc(100vh - 20px)!important;
        transform:none!important;
        margin:0!important;
        padding:0!important;
        border-radius:14px!important;
        overflow:hidden!important;
        z-index:10!important;
        box-shadow:0 8px 24px rgba(18,57,44,.12)!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537.minimised-v58931{
        width:var(--v6065-basket-width)!important;
        max-height:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-head-v58930.schedule-queue-move-handle{
        flex:0 0 auto!important;
        cursor:default!important;
        padding:6px 9px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-head-v58930 .eyebrow{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-head-v58930 h2{
        font-size:.84rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-window-actions-v58931{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-body-v58931{
        display:flex!important;
        flex-direction:column!important;
        flex:1 1 auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow:auto!important;
        gap:2px!important;
        padding:4px 6px 6px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-drop-hint-v58930{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .control{
        min-height:26px!important;
        padding:4px 7px!important;
        font-size:.59rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-groups-v58930{
        display:grid!important;
        gap:2px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930{
        gap:1px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header{
        min-height:13px!important;
        padding-top:1px!important;
        padding-bottom:1px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header strong{
        font-size:.59rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header small{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>div{
        gap:1px!important;
      }

      /* Dense basket rows: keep enough context to identify the client, but fit many names. */
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930{
        display:grid!important;
        grid-template-columns:12px minmax(0,1fr) 9px!important;
        min-height:18px!important;
        padding:0 4px!important;
        gap:3px!important;
        border-radius:5px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930 .basket-card-info-v58931{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930 .queue-work-marker{
        width:11px!important;
        height:11px!important;
        min-width:11px!important;
        font-size:.44rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930{
        display:block!important;
        min-width:0!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930>div:first-child{
        display:block!important;
        min-width:0!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 strong{
        display:block!important;
        font-size:.60rem!important;
        line-height:1!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 .ui-pill{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 small{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .queue-drag-grip{
        align-self:center!important;
        font-size:.60rem!important;
      }

      /* Multi-select controls live at the top of the Drag Mode basket. */
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-tools{
        position:sticky!important;
        top:-5px!important;
        z-index:4!important;
        display:grid!important;
        grid-template-columns:auto auto auto minmax(118px,1fr)!important;
        align-items:center!important;
        gap:4px!important;
        margin:-5px -7px 0!important;
        padding:4px 7px!important;
        border-bottom:1px solid #dce8e2!important;
        background:rgba(247,251,249,.97)!important;
        backdrop-filter:blur(8px)!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-count{
        display:flex!important;
        align-items:baseline!important;
        gap:2px!important;
        min-width:56px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-count strong{
        font-size:.92rem!important;
        color:#155a3f!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-count span{
        font-size:.58rem!important;
        color:#64766e!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-tools .button{
        min-height:24px!important;
        padding:3px 6px!important;
        font-size:.55rem!important;
        white-space:nowrap!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-send-basket{
        justify-self:stretch!important;
      }

      /* Every movable calendar ticket gets a small selection checkbox in Drag Mode. */
      body.schedule-drag-mode-active-v6061 #view-schedule .v6006-job[ondragstart]{
        position:relative!important;
        padding-right:25px!important;
        cursor:grab!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6006-job[ondragstart]:active{cursor:grabbing!important}
      body.schedule-drag-mode-active-v6061 #view-schedule .v6006-job[ondragstart] .v59320-select-tick{
        display:grid!important;
        place-items:center!important;
        position:absolute!important;
        right:4px!important;
        top:4px!important;
        width:16px!important;
        height:16px!important;
        border:1px solid #8ea99d!important;
        border-radius:4px!important;
        background:#fff!important;
        color:transparent!important;
        font-size:.58rem!important;
        line-height:1!important;
        cursor:pointer!important;
        pointer-events:auto!important;
        box-sizing:border-box!important;
        z-index:8!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6006-job.v6065-multi-selected{
        outline:2px solid #176b4b!important;
        outline-offset:-2px!important;
        background:rgba(23,107,75,.10)!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6006-job.v6065-multi-selected .v59320-select-tick{
        border-color:#176b4b!important;
        background:#176b4b!important;
        color:#fff!important;
      }
      body:not(.schedule-drag-mode-active-v6061) #view-schedule .v6006-job .v59320-select-tick{display:none!important}

      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card[ondragstart]{
        position:relative!important;
        padding-right:25px!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card[ondragstart] .v59320-select-tick{
        display:grid!important;
        place-items:center!important;
        position:absolute!important;
        right:4px!important;
        top:4px!important;
        width:16px!important;
        height:16px!important;
        border:1px solid #8ea99d!important;
        border-radius:4px!important;
        background:#fff!important;
        color:transparent!important;
        font-size:.58rem!important;
        line-height:1!important;
        cursor:pointer!important;
        pointer-events:auto!important;
        box-sizing:border-box!important;
        z-index:8!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card.v6065-multi-selected{
        outline:2px solid #176b4b!important;
        outline-offset:-2px!important;
        background:rgba(23,107,75,.10)!important;
        box-shadow:none!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card.v6065-multi-selected .v59320-select-tick{
        border-color:#176b4b!important;
        background:#176b4b!important;
        color:#fff!important;
      }

      /* v60.6.3 hides the normal launcher; the dock itself is always open in Drag Mode. */
      body.schedule-drag-mode-active-v6061 #scheduleBasketLauncherV58931{display:none!important}

      /* Short laptop screens get an extra-dense single-line basket so at least ~20 names remain visible. */
      @media(max-height:820px){
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-body-v58931{
          gap:3px!important;
          padding:4px 6px 6px!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-drop-hint-v58930{
          display:none!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .control{
          min-height:22px!important;
          padding:2px 6px!important;
          font-size:.60rem!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header{
          min-height:14px!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930{
          min-height:17px!important;
          padding:0 3px!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 small{
          display:none!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .v6065-bulk-tools{
          padding-top:3px!important;
          padding-bottom:3px!important;
        }
      }

      @media(max-width:900px){
        body.schedule-drag-mode-active-v6061 #view-schedule .schedule-board-and-parking-v5537{
          grid-template-columns:minmax(0,1fr)!important;
        }
        body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537.schedule-basket-panel-v58930.floating-v58931:not(.hidden){
          grid-column:1!important;
          grid-row:1!important;
          position:relative!important;
          top:auto!important;
          height:420px!important;
          min-height:340px!important;
          max-height:420px!important;
        }
        body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard{
          grid-column:1!important;
          grid-row:2!important;
        }
        body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-grid-clean{
          grid-template-columns:78px repeat(var(--day-count),minmax(92px,1fr))!important;
          min-width:720px!important;
        }
        body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-board-scroll{
          overflow-x:auto!important;
          scrollbar-width:thin!important;
        }
        body.schedule-drag-mode-active-v6061 #weeklyScheduleBoard .schedule-board-scroll::-webkit-scrollbar{display:block!important;height:8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function onClick(event){
    if(!dragModeActive())return;
    const selectAll=event.target?.closest?.('[data-v6065-select-all]');
    if(selectAll){event.preventDefault();event.stopImmediatePropagation();selectAllShown();return;}
    const clear=event.target?.closest?.('[data-v6065-clear]');
    if(clear){event.preventDefault();event.stopImmediatePropagation();clearSelection();return;}
    const send=event.target?.closest?.('[data-v6065-send-basket]');
    if(send){event.preventDefault();event.stopImmediatePropagation();moveIdsToBasket([...selectedSet()]);return;}
    const tick=event.target?.closest?.('#weeklyScheduleBoard [data-job-id] .v59320-select-tick');
    if(tick){
      event.preventDefault();event.stopImmediatePropagation();
      toggleSelected(String(tick.closest('.schedule-card-clean, .v6006-job')?.dataset?.jobId||''));
      return;
    }
    const card=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart], #weeklyScheduleBoard .v6006-job[data-job-id][ondragstart]');
    if(card&&!event.target?.closest?.('.schedule-card-info-v58931')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();toggleSelected(String(card.dataset.jobId||''));return;}
  }

  function onKeyDown(event){
    if(!dragModeActive())return;
    const tick=event.target?.closest?.('#weeklyScheduleBoard [data-job-id] .v59320-select-tick');
    if(tick&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();event.stopImmediatePropagation();
      toggleSelected(String(tick.closest('.schedule-card-clean, .v6006-job')?.dataset?.jobId||''));
      return;
    }
    if(event.key==='Escape'&&selectedSet().size){clearSelection({quiet:true});}
  }

  function onPointerDown(event){
    if(!dragModeActive())return;
    const tick=event.target?.closest?.('#weeklyScheduleBoard [data-job-id] .v59320-select-tick');
    if(tick){event.preventDefault();event.stopImmediatePropagation();return;}
    // The Drag Mode basket is docked, not a draggable floating utility window.
    const handle=event.target?.closest?.('#scheduleParkingLotV5537 .schedule-queue-move-handle');
    if(handle&&!event.target?.closest?.('button')){
      event.stopImmediatePropagation();
    }
  }

  function onDragStart(event){
    if(!dragModeActive())return;
    const card=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart], #weeklyScheduleBoard .v6006-job[data-job-id][ondragstart]');
    if(!card)return;
    const id=String(card.dataset.jobId||'');
    const set=selectedSet();
    if(!set.has(id)||set.size<2)return;
    const ids=selectedMovableIds([...set]);
    if(ids.length<2)return;
    try{
      event.dataTransfer?.setData(MULTI_MIME,JSON.stringify(ids));
      event.dataTransfer?.setData('text/plain',`${ids.length} selected bookings`);
    }catch(_){ }
  }

  function onDropCapture(event){
    if(!dragModeActive())return;
    const basket=event.target?.closest?.('#scheduleParkingLotV5537');
    if(!basket)return;
    let ids=[];
    try{ids=JSON.parse(event.dataTransfer?.getData(MULTI_MIME)||'[]');}catch(_){ids=[];}
    if(!Array.isArray(ids)||ids.length<2)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    basket.classList.remove('is-drop-target');
    moveIdsToBasket(ids);
  }

  function installObserver(){
    if(document.documentElement.__scheduleDragBasketObserverV6065)return;
    const observer=new MutationObserver(queueSync);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    const schedule=document.getElementById('view-schedule');
    if(schedule)observer.observe(schedule,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.documentElement.__scheduleDragBasketObserverV6065=observer;
  }

  function boot(){
    installStyles();
    installObserver();
    document.addEventListener('click',onClick,true);
    document.addEventListener('keydown',onKeyDown,true);
    document.addEventListener('pointerdown',onPointerDown,true);
    document.addEventListener('dragstart',onDragStart,true);
    document.addEventListener('drop',onDropCapture,true);
    lastActive=false;
    queueSync();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.moveSelectedScheduleJobsToBasketV6065=()=>moveIdsToBasket([...selectedSet()]);
  window.clearScheduleDragSelectionV6065=()=>clearSelection({quiet:true});
  window.__tuinbooksScheduleDragBasketBuild=BUILD;
  window.__tuinbooksBuild=BUILD;
})();
