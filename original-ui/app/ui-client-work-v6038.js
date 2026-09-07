/* TuinBooks v60.3.8 — client workspace + Work startup polish
   - one browser scroll on Clients; legacy independent list/editor scroll is neutralised
   - setup/readiness audit is compact by default
   - client list is paged instead of being a second long scroll region
   - NEW R cards are unmistakably gold
   - NEW R is removed when its client is paused / archived / otherwise inactive
   - management Work remains behind the existing loading gate until operational data is ready
*/
(()=>{
  'use strict';
  const BUILD='60.3.8-client-work-polish';
  const PAGE_SIZE=12;
  const $=id=>document.getElementById(id);
  let clientPage=0;
  let clientFilterSignature='';
  let setupInitialised=false;
  let startupOperationalPromise=null;

  function managementRoute(){
    const p=new URLSearchParams(location.search);
    return document.body?.dataset?.app==='desktop'&&p.get('support')==='1'&&!!p.get('business');
  }
  function currentView(){
    return document.querySelector('.nav-tab.active[data-view]')?.dataset?.view||String(window.activeView||'');
  }
  function coreReady(){return !!window.backendV28?.managementCoreReadyV5950;}
  function operationalReady(){
    const b=window.backendV28||{};
    return !!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371);
  }
  function canPersist(){return !window.backendV28||window.backendV28.allowOnboarding!==false;}

  function installStyles(){
    if($('clientWorkPolishStylesV6038'))return;
    const style=document.createElement('style');
    style.id='clientWorkPolishStylesV6038';
    style.textContent=`
      /* Keep setup/readiness available, but out of the way during normal client work. */
      #view-clients:not(.client-setup-expanded-v6037) #clientSummaryCards,
      #view-clients:not(.client-setup-expanded-v6037) #incompleteClientAlert,
      #view-clients:not(.client-setup-expanded-v6037) #clientSetupPanel,
      #view-clients:not(.client-setup-expanded-v6037) #clientReadinessNoticeV59310{display:none!important}
      #view-clients .page-heading{margin-bottom:12px!important;align-items:end!important}
      #view-clients .page-heading>div:first-child p{margin-bottom:0!important}
      #view-clients.client-setup-expanded-v6037 #clientSummaryCards{margin:0 0 10px!important}
      #view-clients.client-setup-expanded-v6037 #incompleteClientAlert,
      #view-clients.client-setup-expanded-v6037 #clientSetupPanel,
      #view-clients.client-setup-expanded-v6037 #clientReadinessNoticeV59310{margin-bottom:10px!important}

      /* One natural page scroll. Older v59 workspace code writes fixed heights inline;
         these important rules deliberately neutralise those inline normal declarations. */
      #view-clients .clients-layout{
        height:auto!important;max-height:none!important;min-height:0!important;
        overflow:visible!important;align-items:start!important;
        grid-template-columns:minmax(310px,.72fr) minmax(0,1.5fr)!important;gap:16px!important;
      }
      #view-clients .clients-layout>.list-panel,
      #view-clients #clientList,
      #view-clients #clientForm.form-panel{
        height:auto!important;max-height:none!important;min-height:0!important;
        overflow:visible!important;overscroll-behavior:auto!important;
      }
      #view-clients .clients-layout>.list-panel{align-self:start!important}
      #view-clients #clientForm.form-panel{align-self:start!important}
      #view-clients #clientList.client-admin-list{padding-right:0!important}
      #view-clients .client-page-hidden-v6038{display:none!important}
      #view-clients .client-list-pager-v6038{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin-top:10px;padding:9px 10px;border-top:1px solid rgba(25,79,58,.12)
      }
      #view-clients .client-list-pager-v6038 span{font-size:12px;color:#61756b;line-height:1.3}
      #view-clients .client-list-pager-v6038>div{display:flex;gap:6px;flex:0 0 auto}
      #view-clients .client-list-pager-v6038 button{min-width:34px}

      /* NEW R must read as a deliberate new-client intake item, not a normal R visit. */
      .schedule-basket-card-v58930.new-recurring-v6036,
      .schedule-basket-card-v58930.new-recurring-v6038{
        background:#fff0aa!important;border:2px solid #d3a20b!important;
        border-left:6px solid #c18b00!important;box-shadow:0 2px 8px rgba(121,84,0,.14)!important
      }
      .schedule-basket-card-v58930.new-recurring-v6036 .queue-work-marker,
      .schedule-basket-card-v58930.new-recurring-v6038 .queue-work-marker{
        background:#d5a000!important;border-color:#9d7400!important;color:#fff!important;font-weight:900!important
      }
      .schedule-basket-card-v58930.new-recurring-v6036 .ui-pill,
      .schedule-basket-card-v58930.new-recurring-v6038 .ui-pill{
        background:#f4c935!important;border-color:#c99a00!important;color:#493400!important;font-weight:900!important
      }
      .schedule-basket-card-v58930.new-recurring-v6036 strong,
      .schedule-basket-card-v58930.new-recurring-v6038 strong{color:#513a00!important}

      @media(max-width:1180px){
        #view-clients .clients-layout{grid-template-columns:1fr!important}
        #view-clients #clientList.client-admin-list{max-height:none!important;overflow:visible!important}
      }
    `;
    document.head.appendChild(style);
  }

  function refreshSetupButton(){
    const button=$('toggleClientSetupV6037'),view=$('view-clients');
    if(!button||!view)return;
    const count=(window.state?.clients||[]).filter(client=>client?.incomplete===true).length;
    button.textContent=count?`Setup issues (${count})`:'Setup issues';
    const expanded=view.classList.contains('client-setup-expanded-v6037');
    button.setAttribute('aria-expanded',expanded?'true':'false');
    button.setAttribute('aria-pressed',expanded?'true':'false');
  }

  function initialiseCompactSetup(){
    const view=$('view-clients');
    if(!view)return;
    if(!setupInitialised){
      view.classList.remove('client-setup-expanded-v6037');
      setupInitialised=true;
    }
    refreshSetupButton();
  }

  function clientRows(){
    const host=$('clientList');if(!host)return [];
    return [...host.children].filter(node=>node.matches?.('.client-card-v55,.client-row'));
  }
  function currentClientFilterSignature(){
    return [
      $('clientSearch')?.value||'', $('clientStatusFilter')?.value||'all',
      $('clientTypeFilter')?.value||'all', $('clientFrequencyFilter')?.value||'all',
      $('clientServiceFilter')?.value||'all'
    ].join('\u241f');
  }
  function renderClientPager(){
    const host=$('clientList');if(!host)return;
    const rows=clientRows(),signature=currentClientFilterSignature();
    if(signature!==clientFilterSignature){clientFilterSignature=signature;clientPage=0;}
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    clientPage=Math.min(Math.max(0,clientPage),pages-1);
    const from=clientPage*PAGE_SIZE,to=Math.min(rows.length,from+PAGE_SIZE);
    rows.forEach((row,index)=>row.classList.toggle('client-page-hidden-v6038',index<from||index>=to));
    let pager=$('clientListPagerV6038');
    if(!pager){pager=document.createElement('div');pager.id='clientListPagerV6038';pager.className='client-list-pager-v6038';host.insertAdjacentElement('afterend',pager);}
    if(rows.length<=PAGE_SIZE){pager.classList.add('hidden');pager.innerHTML='';return;}
    pager.classList.remove('hidden');
    pager.innerHTML=`<span>Showing ${from+1}–${to} of ${rows.length} clients</span><div><button type="button" class="button secondary compact" ${clientPage===0?'disabled':''} data-client-page-v6038="prev" aria-label="Previous clients">‹</button><button type="button" class="button secondary compact" ${clientPage>=pages-1?'disabled':''} data-client-page-v6038="next" aria-label="Next clients">›</button></div>`;
  }
  window.clientListPageV6038=function(direction){
    clientPage+=Number(direction)||0;
    renderClientPager();
    $('clientSearch')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  function bindPager(){
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('[data-client-page-v6038]');if(!button)return;
      const direction=button.dataset.clientPageV6038==='next'?1:-1;
      window.clientListPageV6038(direction);
    });
  }

  function newRClientId(item){return String(item?.clientId||item?.jobPayload?.clientId||'');}
  function clientInactiveForNewR(client){
    if(!client)return true;
    const status=String(client.status||'active').toLowerCase();
    const service=String(client.serviceState||'').toLowerCase();
    return ['paused','archived','deleted','cancelled','canceled','inactive'].includes(status)||
      ['paused','archived','deleted','cancelled','canceled','inactive','quote-only','once-off'].includes(service);
  }
  function pruneInactiveNewR(){
    const state=window.state;if(!state||!Array.isArray(state.scheduleBasket))return 0;
    const clients=new Map((state.clients||[]).map(client=>[String(client.id),client]));
    const removedClients=new Set();
    const before=state.scheduleBasket.length;
    state.scheduleBasket=state.scheduleBasket.filter(item=>{
      if(item?.newRecurringV6036!==true)return true;
      const id=newRClientId(item),client=clients.get(id);
      const remove=clientInactiveForNewR(client);
      if(remove&&id)removedClients.add(id);
      return !remove;
    });
    removedClients.forEach(id=>{const client=clients.get(id);if(client)client.awaitingInitialRecurringPlacementV6036=false;});
    return before-state.scheduleBasket.length;
  }
  function persistPruneIfNeeded(){
    const removed=pruneInactiveNewR();
    if(removed&&canPersist())setTimeout(()=>{try{window.save?.();}catch(error){console.warn('[v60.3.8] NEW R cleanup save',error);}},0);
    return removed;
  }

  function markNewRCardsGold(){
    document.querySelectorAll('.schedule-basket-card-v58930').forEach(card=>{
      if(/(^|\s)NEW\s+R(\s|$)/i.test(String(card.textContent||'')))card.classList.add('new-recurring-v6038');
    });
  }
  function observeBasket(){
    const root=$('scheduleParkingLotV5537');if(!root||root.dataset.newRObserverV6038==='1')return;
    root.dataset.newRObserverV6038='1';
    new MutationObserver(()=>markNewRCardsGold()).observe(root,{childList:true,subtree:true});
  }

  function wrapRuntime(){
    if(typeof window.save==='function'&&!window.save.__v6038Wrapped){
      const base=window.save;
      const wrapped=function(...args){pruneInactiveNewR();return base.apply(this,args);};
      wrapped.__v6038Wrapped=true;window.save=wrapped;
    }
    if(typeof window.renderClients==='function'&&!window.renderClients.__v6038Wrapped){
      const base=window.renderClients;
      const wrapped=function(...args){
        const result=base.apply(this,args);
        requestAnimationFrame(()=>{initialiseCompactSetup();renderClientPager();});
        return result;
      };
      wrapped.__v6038Wrapped=true;window.renderClients=wrapped;
    }
    if(typeof window.renderScheduleQueue==='function'&&!window.renderScheduleQueue.__v6038Wrapped){
      const base=window.renderScheduleQueue;
      const wrapped=function(...args){
        const removed=pruneInactiveNewR();
        const result=base.apply(this,args);
        requestAnimationFrame(()=>{markNewRCardsGold();observeBasket();});
        if(removed&&canPersist())setTimeout(()=>{try{window.save?.();}catch{}},0);
        return result;
      };
      wrapped.__v6038Wrapped=true;window.renderScheduleQueue=wrapped;
    }
    if(typeof window.refreshAppAfterCloudLoadV28==='function'&&!window.refreshAppAfterCloudLoadV28.__v6038Wrapped){
      const base=window.refreshAppAfterCloudLoadV28;
      const wrapped=function(...args){
        const result=base.apply(this,args);
        requestAnimationFrame(()=>{persistPruneIfNeeded();initialiseCompactSetup();renderClientPager();markNewRCardsGold();});
        return result;
      };
      wrapped.__v6038Wrapped=true;window.refreshAppAfterCloudLoadV28=wrapped;
    }
  }

  function stabiliseWorkStartup(){
    if(!managementRoute()||typeof window.hideBackendGateV28!=='function'||window.hideBackendGateV28.__v6038Wrapped)return;
    const hideBase=window.hideBackendGateV28;
    const wrappedHide=function(...args){
      if(coreReady()&&!operationalReady()&&currentView()==='records'){
        try{window.setBackendLoadingV28?.('Loading Work…');}catch{}
        if(!startupOperationalPromise&&typeof window.loadManagementOperationalV5950==='function'){
          startupOperationalPromise=Promise.resolve().then(()=>window.loadManagementOperationalV5950()).then(()=>{
            try{window.refreshAppAfterCloudLoadV28?.();}catch(error){console.warn('[v60.3.8] Work refresh',error);}
            try{window.showView?.('records');}catch(error){console.warn('[v60.3.8] Work final view',error);}
            hideBase.apply(window,args);
          }).catch(error=>{
            console.error('[v60.3.8] Work startup load',error);
            // Hand control back to the existing route/error handling rather than flashing stale Work.
            try{window.showView?.('records');}catch{}
          });
        }
        return;
      }
      return hideBase.apply(this,args);
    };
    wrappedHide.__v6038Wrapped=true;window.hideBackendGateV28=wrappedHide;
  }

  function markBuild(){
    window.__tuinbooksBuild=BUILD;
    const marker=document.querySelector('[id^="tuinbooksBuildV"]');
    if(marker){marker.id='tuinbooksBuildV6038';marker.textContent='v60.3.8';marker.title='Client/Work polish · frozen Schedule remains v60.3.5';}
  }

  function install(){
    installStyles();wrapRuntime();stabiliseWorkStartup();bindPager();initialiseCompactSetup();
    persistPruneIfNeeded();renderClientPager();markNewRCardsGold();observeBasket();markBuild();
    // Release marker v60.3.5 reasserts itself for a few seconds; keep the visible patch marker current.
    setTimeout(markBuild,1300);setTimeout(markBuild,4200);
    window.__tuinbooksClientWorkPolishV6038={build:BUILD,pageSize:PAGE_SIZE,onePageScroll:true,newRGold:true,inactiveNewRRemoved:true,setupCollapsed:true,workStartupStable:true};
  }
  // This file is loaded last at the bottom of index.html, after the frozen Schedule/Work bundles.
  // Install immediately so the management startup gate is wrapped before initDesktop/auth DOMContentLoaded handlers run.
  install();
})();
