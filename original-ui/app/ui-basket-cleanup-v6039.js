/* TuinBooks v60.3.9 — recurring Schedule Basket cleanup
   - Paused / archived / inactive clients cannot retain recurring Basket work
   - includes legacy "Removed from calendar" recurring cards, not only NEW R
   - recurring manual Basket cards get a small explicit Remove (×) action
   - removing a Basket card does not delete the client, history, Work, invoices or visits
   - frozen v60.3.5 Schedule renderer remains untouched
*/
(()=>{
  'use strict';
  const BUILD='60.3.9-basket-cleanup';
  const $=id=>document.getElementById(id);
  let cleanupSaveInProgress=false;

  function appState(){return window.state||null;}
  function normal(value){return String(value||'').trim().toLowerCase().replace(/[-\s]+/g,'_');}
  function clientInactive(client){
    if(!client)return true;
    const status=normal(client.status||'active');
    const service=normal(client.serviceState||'');
    return ['paused','archived','deleted','cancelled','canceled','inactive'].includes(status)
      || ['paused','archived','deleted','cancelled','canceled','inactive'].includes(service);
  }
  function itemMarker(item){
    const explicit=String(item?.workMarker||item?.jobPayload?.workMarker||'').trim().toUpperCase();
    if(explicit)return explicit;
    if(item?.newRecurringV6036===true)return 'R';
    if(item?.quoteId||item?.jobPayload?.quoteId||item?.quickJobV59396||item?.stockOrderIdV58940)return 'O';
    return String(item?.workKind||item?.jobPayload?.workKind||'').toLowerCase().includes('once')?'O':'R';
  }
  function recurringBasketItem(item){
    if(!item)return false;
    if(item?.quoteId||item?.jobPayload?.quoteId||item?.quickJobV59396||item?.jobPayload?.quickJobV59396||item?.stockOrderIdV58940)return false;
    return itemMarker(item)==='R';
  }
  function clientMap(state){return new Map((state?.clients||[]).map(client=>[String(client.id),client]));}

  function pruneInactiveRecurringBasket(){
    const state=appState();
    if(!state)return {basket:0,overflow:0,total:0};
    const clients=clientMap(state);
    let basket=0,overflow=0;

    if(Array.isArray(state.scheduleBasket)){
      state.scheduleBasket=state.scheduleBasket.filter(item=>{
        if(!recurringBasketItem(item))return true;
        const client=clients.get(String(item?.clientId||item?.jobPayload?.clientId||''));
        if(!clientInactive(client))return true;
        basket++;
        if(client)client.awaitingInitialRecurringPlacementV6036=false;
        return false;
      });
    }

    // "Could not fit" is displayed in the same Schedule Basket even though it
    // lives in scheduleOverflowQueue rather than scheduleBasket.
    if(Array.isArray(state.scheduleOverflowQueue)){
      state.scheduleOverflowQueue=state.scheduleOverflowQueue.filter(item=>{
        const marker=String(item?.workMarker||'R').toUpperCase();
        if(marker!=='R'||item?.quoteId)return true;
        const client=clients.get(String(item?.clientId||''));
        if(!clientInactive(client))return true;
        overflow++;
        return false;
      });
    }
    return {basket,overflow,total:basket+overflow};
  }

  function persistCleanupIfNeeded(showFeedback=false){
    if(cleanupSaveInProgress)return 0;
    const result=pruneInactiveRecurringBasket();
    if(!result.total)return 0;
    cleanupSaveInProgress=true;
    try{
      window.save?.();
      if(showFeedback)window.toast?.(`${result.total} inactive recurring Basket item${result.total===1?'':'s'} removed.`);
    }catch(error){console.warn('[v60.3.9] Basket cleanup save failed',error);}
    finally{cleanupSaveInProgress=false;}
    return result.total;
  }

  function queueKeyFromCard(card){
    const source=String(card?.getAttribute('ondragstart')||'');
    const match=source.match(/startQueueItemDragV58930\(event,'([^']+)'\)/);
    return match?.[1]||'';
  }
  function isRemovableRecurringCard(card){
    return !!card?.classList?.contains('source-manual-basket')
      && String(card.querySelector('.queue-work-marker')?.textContent||'').trim().toUpperCase()==='R';
  }

  window.removeRecurringBasketItemV6039=function(key){
    const state=appState();if(!state||!Array.isArray(state.scheduleBasket))return;
    const id=String(key||'').replace(/^manual-basket:/,'');
    const item=state.scheduleBasket.find(row=>String(row?.id||'')===id);
    if(!item||!recurringBasketItem(item))return window.toast?.('This recurring Basket item could not be found.','error');
    const client=(state.clients||[]).find(row=>String(row?.id||'')===String(item.clientId||item?.jobPayload?.clientId||''));
    const name=client?.name||'this client';
    if(!window.confirm(`Remove ${name} from the Schedule basket?\n\nThis does not delete the client, completed work, invoices or history.`))return;
    state.scheduleBasket=state.scheduleBasket.filter(row=>String(row?.id||'')!==id);
    if(client&&item?.newRecurringV6036===true)client.awaitingInitialRecurringPlacementV6036=false;
    try{window.save?.();}catch(error){console.error('[v60.3.9] Basket remove save',error);return window.toast?.('The Basket item could not be saved as removed.','error');}
    try{window.renderSchedule?.();}catch(error){console.warn('[v60.3.9] Schedule refresh',error);}
    requestAnimationFrame(()=>installRemoveButtons());
    window.toast?.(`${name} removed from the Schedule basket.`);
  };

  function installRemoveButtons(){
    document.querySelectorAll('.schedule-basket-card-v58930').forEach(card=>{
      if(!isRemovableRecurringCard(card)||card.querySelector('.basket-remove-v6039'))return;
      const key=queueKeyFromCard(card);if(!key)return;
      const button=document.createElement('button');
      button.type='button';button.draggable=false;button.className='basket-remove-v6039';
      button.setAttribute('aria-label','Remove recurring work from basket');
      button.title='Remove from basket';button.textContent='×';
      button.addEventListener('pointerdown',event=>event.stopPropagation());
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();window.removeRecurringBasketItemV6039(key);});
      const info=card.querySelector('.basket-card-info-v58931');
      if(info)card.insertBefore(button,info);else card.appendChild(button);
    });
  }

  function installStyles(){
    if($('basketCleanupStylesV6039'))return;
    const style=document.createElement('style');style.id='basketCleanupStylesV6039';
    style.textContent=`
      .schedule-basket-card-v58930 .basket-remove-v6039{
        width:24px;height:24px;min-width:24px;padding:0;border:1px solid rgba(95,55,35,.2);
        border-radius:999px;background:#fff;color:#8b3b2f;font-size:17px;font-weight:800;
        line-height:20px;display:grid;place-items:center;cursor:pointer;align-self:center;
      }
      .schedule-basket-card-v58930 .basket-remove-v6039:hover,
      .schedule-basket-card-v58930 .basket-remove-v6039:focus{background:#fff0ed;border-color:#b54a3c;outline:none}
      .schedule-basket-card-v58930.new-recurring-v6036 .basket-remove-v6039,
      .schedule-basket-card-v58930.new-recurring-v6038 .basket-remove-v6039{background:#fff8d4;border-color:#b98b00;color:#674a00}
    `;
    document.head.appendChild(style);
  }

  function wrapSave(){
    if(typeof window.save!=='function'||window.save.__v6039BasketWrapped)return;
    const base=window.save;
    const wrapped=function(...args){
      if(!cleanupSaveInProgress)pruneInactiveRecurringBasket();
      return base.apply(this,args);
    };
    wrapped.__v6039BasketWrapped=true;window.save=wrapped;
  }

  function wrapScheduleRender(){
    if(window.__TUINBOOKS_SCHEDULE_V2_ENABLED__===true)return;
    if(typeof window.renderSchedule!=='function'||window.renderSchedule.__v6039BasketWrapped)return;
    const base=window.renderSchedule;
    const wrapped=function(...args){
      pruneInactiveRecurringBasket();
      const result=base.apply(this,args);
      requestAnimationFrame(()=>installRemoveButtons());
      return result;
    };
    wrapped.__v6039BasketWrapped=true;window.renderSchedule=wrapped;
  }

  function observeBasket(){
    const root=$('scheduleParkingLotV5537');if(!root||root.dataset.cleanupObserverV6039==='1')return;
    root.dataset.cleanupObserverV6039='1';
    new MutationObserver(()=>installRemoveButtons()).observe(root,{childList:true,subtree:true});
  }

  function wrapCloudRefresh(){
    if(typeof window.refreshAppAfterCloudLoadV28!=='function'||window.refreshAppAfterCloudLoadV28.__v6039BasketWrapped)return;
    const base=window.refreshAppAfterCloudLoadV28;
    const wrapped=function(...args){
      const result=base.apply(this,args);
      requestAnimationFrame(()=>{persistCleanupIfNeeded(false);installRemoveButtons();observeBasket();});
      return result;
    };
    wrapped.__v6039BasketWrapped=true;window.refreshAppAfterCloudLoadV28=wrapped;
  }

  function markBuild(){
    const marker=document.querySelector('[id^="tuinbooksBuildV"]');
    if(marker){marker.id='tuinbooksBuildV6039';marker.textContent='v60.3.9';marker.title='Basket cleanup · frozen Schedule remains v60.3.5';}
  }

  function install(){
    installStyles();wrapSave();wrapScheduleRender();wrapCloudRefresh();
    // Existing paused/archived stale cards are removed immediately after this patch loads.
    persistCleanupIfNeeded(false);installRemoveButtons();observeBasket();markBuild();
    setTimeout(()=>{wrapSave();wrapScheduleRender();wrapCloudRefresh();persistCleanupIfNeeded(false);installRemoveButtons();observeBasket();markBuild();},1200);
    setTimeout(()=>{persistCleanupIfNeeded(false);installRemoveButtons();markBuild();},4200);
    window.__tuinbooksBasketCleanupV6039={build:BUILD,inactiveRecurringPrune:true,legacyRemovedFromCalendar:true,manualRemove:true,historyPreserved:true};
  }
  install();
})();
