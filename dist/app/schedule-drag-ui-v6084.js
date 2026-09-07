/* TuinBooks v60.8.4 — ZERO-VISUAL Schedule drag/basket consolidation
   Source baseline: TUINBOOKS-main (63)(1).zip
   The five previously contiguous late-loaded Schedule UI files are preserved in
   their original order inside this single module. Normal Schedule rendering is
   intentionally unchanged. Only two basket interaction defects are corrected
   in the final section: the compact/minimised basket control opens reliably,
   and Drag Mode continuously guarantees the existing basket is present.
*/

/* ===== BEGIN ORIGINAL schedule-card-clean-v6060.js ===== */
/* TuinBooks v60.6.0 — late schedule-card layout repair
   Loaded after visit-controls so the compact card layout wins over legacy
   three-column card CSS that reserves a marker column. */
(()=>{
  const BUILD='60.6.0-schedule-card-clean-late-fix';
  function install(){
    if(document.getElementById('scheduleCardCleanStylesV6060'))return;
    const style=document.createElement('style');
    style.id='scheduleCardCleanStylesV6060';
    style.textContent=`
      /* v60.5.9 removed the R/O marker from the card DOM. Legacy styles still
         reserve a 17px first grid column for that marker, which crushed the
         client name into a narrow vertical strip. Use a true two-column card. */
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 18px!important;
        grid-template-rows:auto!important;
        min-height:48px!important;
        height:auto!important;
        padding:7px 7px 7px 10px!important;
        column-gap:7px!important;
        row-gap:0!important;
        align-items:center!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy.v6059-card-copy{
        grid-column:1!important;
        grid-row:1!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:stretch!important;
        justify-content:center!important;
        width:auto!important;
        min-width:0!important;
        overflow:hidden!important;
        gap:3px!important;
        padding:0!important;
        margin:0!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy strong{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        margin:0!important;
        padding:0!important;
        font-size:.72rem!important;
        line-height:1.16!important;
        font-weight:850!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        overflow-wrap:normal!important;
        word-break:normal!important;
        -webkit-line-clamp:unset!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-suburb{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        margin:0!important;
        padding:0!important;
        font-size:.61rem!important;
        line-height:1.12!important;
        font-weight:650!important;
        color:#65776e!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        overflow-wrap:normal!important;
        word-break:normal!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-info-v58931{
        grid-column:2!important;
        grid-row:1!important;
        position:static!important;
        align-self:start!important;
        justify-self:end!important;
        margin:0!important;
        width:16px!important;
        height:16px!important;
        min-width:16px!important;
        line-height:14px!important;
        font-size:.58rem!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .v59320-select-tick{
        position:absolute!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-work-marker,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-meta,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-duration,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .v59384-card-meta-right,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-resize{
        display:none!important;
      }
      /* Keep the week chrome intentionally quiet. */
      #view-schedule .rolling-plan-panel{padding-top:4px!important}
      #view-schedule .v6059-schedule-nav{margin-bottom:6px!important}
    `;
    document.head.appendChild(style);
  }
  install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  window.__tuinbooksScheduleCardCleanBuild=BUILD;
})();

/* ===== END ORIGINAL schedule-card-clean-v6060.js ===== */

/* ===== BEGIN ORIGINAL schedule-drag-mode-v6061.js ===== */
/* TuinBooks v60.6.1 — harden activated Schedule drag mode
   Loaded last, after the frozen schedule renderer and card-layout repair.
   Owns the visible Drag mode state and synchronises it to the actual cards. */
(()=>{
  const BUILD='60.6.1-schedule-drag-mode-hard-fix';
  const STORAGE_KEY='tuinbooks.scheduleDragScope.v6061';
  let active=false;               // deliberately OFF after every page reload
  let scope='once';
  let lastToggleAt=0;
  let lastScopeAt=0;
  let syncQueued=false;

  try{
    const saved=localStorage.getItem(STORAGE_KEY)||localStorage.getItem('tuinbooks.scheduleDragScope.v6059');
    if(saved==='future'||saved==='once')scope=saved;
  }catch(_){ }

  const currentScope=()=>scope==='future'?'future':'once';
  const modeActive=()=>active===true;
  const now=()=>{try{return performance.now();}catch(_){return Date.now();}};

  function toastSafe(message,type){try{window.toast?.(message,type);}catch(_){ }}
  function persistScope(){
    try{
      localStorage.setItem(STORAGE_KEY,currentScope());
      localStorage.setItem('tuinbooks.scheduleDragScope.v6059',currentScope());
    }catch(_){ }
  }

  function movableCards(){
    try{return [...document.querySelectorAll('#view-schedule .schedule-card-clean.v6059-minimal-card[ondragstart]')];}
    catch(_){return [];}
  }

  function syncCards(){
    syncQueued=false;
    document.body?.classList.toggle('schedule-drag-mode-active-v6059',active);
    document.body?.classList.toggle('schedule-drag-mode-active-v6061',active);

    movableCards().forEach(card=>{
      card.draggable=active;
      card.setAttribute('draggable',active?'true':'false');
      card.classList.toggle('schedule-drag-enabled-v6059',active);
      card.classList.toggle('schedule-drag-enabled-v6061',active);
    });

    // Cards that are not genuine movable visits must always stay locked.
    try{
      document.querySelectorAll('#view-schedule .schedule-card-clean.v6059-minimal-card:not([ondragstart])').forEach(card=>{
        card.draggable=false;
        card.setAttribute('draggable','false');
        card.classList.remove('schedule-drag-enabled-v6059','schedule-drag-enabled-v6061');
      });
    }catch(_){ }
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(syncCards);
  }

  function controlsMarkup(){
    return `${active?`<span class="v6059-drag-scope"><button type="button" data-schedule-drag-scope-v6059="once" class="${currentScope()==='once'?'active':''}">THIS VISIT</button><button type="button" data-schedule-drag-scope-v6059="future" class="${currentScope()==='future'?'active':''}">THIS + FUTURE</button></span>`:''}<button type="button" class="button ${active?'':'secondary'} compact v6059-drag-button ${active?'active':''}" data-schedule-drag-toggle-v6059 aria-pressed="${active?'true':'false'}">${active?'✓ Done dragging':'↔ Drag mode'}</button>`;
  }

  function paintControls(){
    try{
      const host=document.querySelector('#view-schedule .v6059-drag-controls');
      if(host)host.innerHTML=controlsMarkup();
    }catch(_){ }
  }

  function refreshChrome(){
    // Prefer the normal Schedule chrome renderer so week navigation remains unchanged.
    try{window.renderRollingScheduleOverviewV6001?.();}
    catch(_){paintControls();}
    // In case the renderer is not currently exposed, paint the existing host directly.
    paintControls();
    queueSync();
  }

  function setScope(next,quiet=false){
    const t=now();
    // Two legacy delegated listeners can see the same click. Ignore the duplicate call.
    if(t-lastScopeAt<60 && (next==='future'?'future':'once')===scope)return scope;
    lastScopeAt=t;
    scope=next==='future'?'future':'once';
    persistScope();
    refreshChrome();
    if(!quiet)toastSafe(`Drag changes: ${scope==='future'?'this + future':'this visit'}.`);
    return scope;
  }

  function toggle(force,quiet=false){
    const t=now();
    // Protect against the old capture listener plus the fallback listener both firing.
    if(typeof force!=='boolean' && t-lastToggleAt<80)return active;
    lastToggleAt=t;
    active=typeof force==='boolean'?force:!active;

    if(!active){
      try{window.endScheduleDrag?.();}catch(_){ }
      try{document.querySelectorAll('.schedule-day-lane.drag-preview').forEach(el=>el.classList.remove('drag-preview','preview-safe','preview-near','preview-over','preview-blocked'));}catch(_){ }
    }

    refreshChrome();
    if(!quiet)toastSafe(active?`Drag mode on — ${scope==='future'?'this + future':'this visit'}.`:'Drag mode off. Schedule locked.');
    return active;
  }

  // Replace all earlier public drag-mode hooks. The frozen schedule wrapper reads these.
  window.isScheduleDragModeV6059=modeActive;
  window.isScheduleDragModeV6057=modeActive;
  window.getScheduleDragScopeV6059=currentScope;
  window.getScheduleDragScopeV6057=currentScope;
  window.getScheduleDragScopeV6056=currentScope;
  window.setScheduleDragScopeV6059=setScope;
  window.setScheduleDragScopeV6057=setScope;
  window.setScheduleDragScopeV6056=setScope;
  window.toggleScheduleDragModeV6059=toggle;
  window.toggleScheduleDragModeV6057=toggle;

  // Fallback delegated handler. If the older app listener already handled the click,
  // lastToggleAt/lastScopeAt prevents a second toggle.
  document.addEventListener('click',event=>{
    const toggleButton=event.target?.closest?.('[data-schedule-drag-toggle-v6059]');
    if(toggleButton){
      event.preventDefault();
      event.stopPropagation();
      const seen=lastToggleAt;
      setTimeout(()=>{if(lastToggleAt===seen)toggle();},0);
      return;
    }
    const scopeButton=event.target?.closest?.('[data-schedule-drag-scope-v6059]');
    if(scopeButton){
      event.preventDefault();
      event.stopPropagation();
      const seen=lastScopeAt;
      const next=scopeButton.dataset.scheduleDragScopeV6059;
      setTimeout(()=>{if(lastScopeAt===seen)setScope(next);},0);
    }
  },true);

  // Hard safety gate: no Schedule card can begin a drag while Drag mode is off.
  document.addEventListener('dragstart',event=>{
    const card=event.target?.closest?.('#view-schedule .schedule-card-clean.v6059-minimal-card');
    if(!card)return;
    if(!active){
      event.preventDefault();
      event.stopImmediatePropagation();
      toastSafe('Turn on Drag mode to rearrange the schedule.');
      return;
    }
    // Ensure native drag remains enabled even if a renderer replaced the card a moment ago.
    card.draggable=true;
    card.setAttribute('draggable','true');
  },true);

  function installStyles(){
    if(document.getElementById('scheduleDragModeStylesV6061'))return;
    const style=document.createElement('style');
    style.id='scheduleDragModeStylesV6061';
    style.textContent=`
      body:not(.schedule-drag-mode-active-v6061) #view-schedule .schedule-card-clean.v6059-minimal-card{cursor:pointer!important}
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card.schedule-drag-enabled-v6061{cursor:grab!important;outline:1px solid rgba(31,109,74,.18)}
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v6059-minimal-card.schedule-drag-enabled-v6061:active{cursor:grabbing!important}
    `;
    document.head.appendChild(style);
  }

  function installObserver(){
    const root=document.getElementById('view-schedule');
    if(!root||root.__scheduleDragObserverV6061)return;
    const observer=new MutationObserver(()=>queueSync());
    observer.observe(root,{childList:true,subtree:true});
    root.__scheduleDragObserverV6061=observer;
  }

  function boot(){
    installStyles();
    installObserver();
    toggle(false,true);
    refreshChrome();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.__tuinbooksScheduleDragModeBuild='60.6.1-schedule-drag-mode-hard-fix';
  window.__tuinbooksBuild=BUILD;
})();

/* ===== END ORIGINAL schedule-drag-mode-v6061.js ===== */

/* ===== BEGIN ORIGINAL schedule-drag-focus-v6063.js ===== */
/* TuinBooks v60.6.3 — focused Schedule drag layout
   Drag mode becomes a stripped-down rearrangement board.
   Normal Schedule layout is untouched when drag mode is off. */
(()=>{
  const BUILD='60.6.3-clear-drag-labels-settings-import-only';
  let queued=false;

  function active(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  function compactDayLabels(){
    if(!active())return;
    document.querySelectorAll('#view-schedule .schedule-day-heading').forEach(head=>{
      const strong=head.querySelector('strong');
      const date=head.querySelector('span');
      if(strong){
        if(!strong.dataset.v6062Full)strong.dataset.v6062Full=strong.textContent||'';
        const full=strong.dataset.v6062Full.trim();
        strong.textContent=full.slice(0,3).toUpperCase();
      }
      if(date){
        if(!date.dataset.v6062Full)date.dataset.v6062Full=date.textContent||'';
        const full=date.dataset.v6062Full.trim();
        const day=(full.match(/\b\d{1,2}\b/)||[])[0]||full;
        date.textContent=day;
      }
    });
  }

  function restoreDayLabels(){
    document.querySelectorAll('#view-schedule .schedule-day-heading strong[data-v6062-full], #view-schedule .schedule-day-heading span[data-v6062-full]').forEach(node=>{
      node.textContent=node.dataset.v6062Full||node.textContent;
      delete node.dataset.v6062Full;
    });
  }

  function compactControlLabels(){
    const isOn=active();
    document.querySelectorAll('#view-schedule [data-schedule-drag-scope-v6059]').forEach(btn=>{
      if(!btn.dataset.v6062Full)btn.dataset.v6062Full=btn.textContent||'';
      if(isOn)btn.textContent=btn.dataset.scheduleDragScopeV6059==='future'?'THIS + FUTURE':'THIS VISIT';
      else if(btn.dataset.v6062Full){btn.textContent=btn.dataset.v6062Full;delete btn.dataset.v6062Full;}
    });
    const toggle=document.querySelector('#view-schedule [data-schedule-drag-toggle-v6059]');
    if(toggle){
      if(!toggle.dataset.v6062Full)toggle.dataset.v6062Full=toggle.textContent||'';
      if(isOn)toggle.textContent='✓ DONE';
      else if(toggle.dataset.v6062Full){toggle.textContent='↔ Drag mode';delete toggle.dataset.v6062Full;}
    }
  }

  function sync(){
    queued=false;
    if(active())compactDayLabels();
    else restoreDayLabels();
    compactControlLabels();
  }
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(sync);
  }

  function installStyles(){
    if(document.getElementById('scheduleDragFocusStylesV6062'))return;
    const style=document.createElement('style');
    style.id='scheduleDragFocusStylesV6062';
    style.textContent=`
      /* ------------------------------------------------------------
         DRAG MODE = focused rearrangement board
         Normal Schedule is intentionally unaffected.
         ------------------------------------------------------------ */
      body.schedule-drag-mode-active-v6061 #view-schedule .rolling-week-strip,
      body.schedule-drag-mode-active-v6061 #view-schedule .v6001-week-strip,
      body.schedule-drag-mode-active-v6061 #view-schedule #schedulePrioritySummaryV5535,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-attention-strip-clean,
      body.schedule-drag-mode-active-v6061 #view-schedule .v6010-calendar-actions,
      body.schedule-drag-mode-active-v6061 #view-schedule .v6007-day-add,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-destination-group > header,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-info-v58931,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-suburb,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-meta,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-duration,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-work-marker,
      body.schedule-drag-mode-active-v6061 #view-schedule .v59384-card-meta-right,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-resize,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-team-heading > span,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-team-heading > small,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-heading > small,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-grid-corner > span,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-lane-head,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-empty-lane,
      body.schedule-drag-mode-active-v6061 #scheduleBasketLauncherV58931{
        display:none!important;
      }

      body.schedule-drag-mode-active-v6061 #view-schedule .rolling-plan-panel{
        padding-top:2px!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-schedule-nav{
        margin:0 0 5px!important;
        gap:4px!important;
        min-height:28px!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-selected-week{
        font-size:.62rem!important;
        opacity:.72!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-controls{
        gap:4px!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-scope button,
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-button{
        min-height:25px!important;
        padding:3px 7px!important;
        font-size:.58rem!important;
        line-height:1!important;
        letter-spacing:.02em!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-history-nav-v6001 > .button{
        min-height:25px!important;
        padding:3px 6px!important;
        font-size:.58rem!important;
      }

      /* Fixed labels: only Team + MON/TUE/... + date number. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-grid-corner,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-heading,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-team-heading{
        min-height:28px!important;
        padding:4px 6px!important;
        box-sizing:border-box!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-grid-corner strong,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-team-heading strong{
        font-size:.62rem!important;
        line-height:1.05!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-heading{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:4px!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-heading strong{
        font-size:.61rem!important;
        line-height:1!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-heading span{
        font-size:.56rem!important;
        line-height:1!important;
        opacity:.68!important;
      }

      /* Day lanes collapse around the actual tickets. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-lane{
        min-height:34px!important;
        height:auto!important;
        padding:3px!important;
        box-sizing:border-box!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-lane-cards{
        display:flex!important;
        flex-direction:column!important;
        gap:2px!important;
        min-height:24px!important;
      }

      /* Tickets become single-line move handles: CLIENT NAME ONLY. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card{
        display:block!important;
        min-height:25px!important;
        height:25px!important;
        padding:4px 6px!important;
        border-radius:5px!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
        box-shadow:none!important;
        outline:0!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy.v6059-card-copy{
        display:block!important;
        width:100%!important;
        min-width:0!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy strong{
        display:block!important;
        width:100%!important;
        margin:0!important;
        padding:0!important;
        font-size:.61rem!important;
        line-height:17px!important;
        font-weight:800!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.missed-unresolved-v58928::after,
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-card-clean.missed-unresolved-v58928::before{
        display:none!important;
      }

      /* Destination groups stop adding visual bulk in rearrange mode. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-destination-group{
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-destination-group > div{
        display:flex!important;
        flex-direction:column!important;
        gap:2px!important;
      }

      /* Insertion points are hairlines until you drag across them. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-insert-zone-v58930{
        display:block!important;
        height:2px!important;
        min-height:2px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        overflow:hidden!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-insert-zone-v58930 span{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-insert-zone-v58930.active{
        height:13px!important;
        min-height:13px!important;
        margin:1px 0!important;
        border:1px dashed #1f6d4a!important;
        border-radius:4px!important;
        background:rgba(31,109,74,.08)!important;
      }

      /* Strong but quiet target feedback. */
      body.schedule-drag-mode-active-v6061 #view-schedule .schedule-day-lane.drag-preview{
        outline:1px solid rgba(31,109,74,.55)!important;
        outline-offset:-1px!important;
      }

      @media(max-width:900px){
        body.schedule-drag-mode-active-v6061 #view-schedule .v6059-selected-week{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installObserver(){
    if(document.documentElement.__scheduleDragFocusObserverV6062)return;
    const observer=new MutationObserver(queue);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class'],subtree:false});
    const schedule=document.getElementById('view-schedule');
    if(schedule)observer.observe(schedule,{childList:true,subtree:true});
    document.documentElement.__scheduleDragFocusObserverV6062=observer;
  }

  function boot(){installStyles();installObserver();sync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.__tuinbooksScheduleDragFocusBuild=BUILD;
})();

/* ===== END ORIGINAL schedule-drag-focus-v6063.js ===== */

/* ===== BEGIN ORIGINAL schedule-drag-polish-v6064.js ===== */
/* TuinBooks v60.6.4 — human-friendly drag controls
   Cosmetic/UX layer only. Drag behaviour remains owned by v60.6.1. */
(()=>{
  const BUILD='60.6.4-human-drag-controls';
  let queued=false;

  function isActive(){
    return document.body?.classList.contains('schedule-drag-mode-active-v6061') ||
           document.body?.classList.contains('schedule-drag-mode-active-v6059');
  }

  function ensureScopeLabel(scope){
    if(!scope) return;
    let label=scope.querySelector('.v6064-scope-label');
    if(!label){
      label=document.createElement('span');
      label.className='v6064-scope-label';
      label.textContent='Move:';
      scope.prepend(label);
    }
  }

  function sync(){
    queued=false;
    const root=document.getElementById('view-schedule');
    if(!root) return;
    const active=isActive();

    const scope=root.querySelector('.v6059-drag-scope');
    if(scope){
      ensureScopeLabel(scope);
      scope.setAttribute('role','group');
      scope.setAttribute('aria-label','Choose what moving a booking changes');
      const once=scope.querySelector('[data-schedule-drag-scope-v6059="once"]');
      const future=scope.querySelector('[data-schedule-drag-scope-v6059="future"]');
      if(once){
        once.textContent='This visit only';
        once.title='Move only the booking you drag. Future recurring visits stay where they are.';
        once.setAttribute('aria-label','This visit only — move only this booking');
      }
      if(future){
        future.textContent='This & future visits';
        future.title='Move this booking and update future recurring visits to the new team or day.';
        future.setAttribute('aria-label','This and future visits — move this booking and future recurring visits');
      }
    }

    const toggle=root.querySelector('[data-schedule-drag-toggle-v6059]');
    if(toggle){
      toggle.textContent=active?'Finish moving':'Rearrange schedule';
      toggle.title=active?'Finish rearranging and lock the schedule again.':'Turn on drag mode to rearrange bookings.';
      toggle.setAttribute('aria-label',toggle.title);
    }
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(sync);
  }

  function installStyles(){
    if(document.getElementById('scheduleDragPolishStylesV6064'))return;
    const style=document.createElement('style');
    style.id='scheduleDragPolishStylesV6064';
    style.textContent=`
      #view-schedule .v6059-drag-controls{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
      }
      #view-schedule .v6059-drag-scope{
        display:inline-flex!important;
        align-items:center!important;
        gap:0!important;
        padding:3px!important;
        border:1px solid rgba(20,78,55,.18)!important;
        border-radius:10px!important;
        background:rgba(20,78,55,.045)!important;
        box-shadow:0 1px 2px rgba(0,0,0,.025)!important;
      }
      #view-schedule .v6064-scope-label{
        display:inline-flex!important;
        align-items:center!important;
        padding:0 8px 0 6px!important;
        min-height:28px!important;
        font-size:.68rem!important;
        line-height:1!important;
        font-weight:700!important;
        color:#466157!important;
        white-space:nowrap!important;
      }
      #view-schedule .v6059-drag-scope button{
        min-height:28px!important;
        padding:5px 10px!important;
        border:0!important;
        border-radius:7px!important;
        background:transparent!important;
        color:#284b3e!important;
        font:inherit!important;
        font-size:.67rem!important;
        font-weight:700!important;
        line-height:1!important;
        letter-spacing:0!important;
        text-transform:none!important;
        box-shadow:none!important;
        cursor:pointer!important;
        white-space:nowrap!important;
      }
      #view-schedule .v6059-drag-scope button:hover{
        background:rgba(20,78,55,.075)!important;
      }
      #view-schedule .v6059-drag-scope button.active,
      #view-schedule .v6059-drag-scope button[aria-pressed="true"]{
        background:#fff!important;
        color:#0f5135!important;
        box-shadow:0 1px 3px rgba(0,0,0,.11)!important;
      }
      #view-schedule .v6059-drag-button{
        min-height:34px!important;
        padding:7px 13px!important;
        border-radius:9px!important;
        font-size:.7rem!important;
        font-weight:800!important;
        line-height:1!important;
        letter-spacing:0!important;
        text-transform:none!important;
        white-space:nowrap!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-button{
        background:#145c40!important;
        color:#fff!important;
        border-color:#145c40!important;
      }

      /* Focused drag board: keep controls readable rather than shrinking them to developer-sized chips. */
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-scope button{
        min-height:28px!important;
        padding:5px 9px!important;
        font-size:.65rem!important;
        letter-spacing:0!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6059-drag-button{
        min-height:30px!important;
        padding:5px 11px!important;
        font-size:.66rem!important;
        letter-spacing:0!important;
      }
      body.schedule-drag-mode-active-v6061 #view-schedule .v6064-scope-label{
        min-height:28px!important;
        font-size:.65rem!important;
      }

      @media(max-width:900px){
        #view-schedule .v6059-drag-controls{gap:5px!important}
        #view-schedule .v6064-scope-label{display:none!important}
        #view-schedule .v6059-drag-scope button{padding:5px 7px!important;font-size:.62rem!important}
        #view-schedule .v6059-drag-button{padding:6px 9px!important;font-size:.64rem!important}
      }
    `;
    document.head.appendChild(style);
  }

  function boot(){
    installStyles();
    sync();
    const obs=new MutationObserver(queue);
    obs.observe(document.documentElement,{attributes:true,attributeFilter:['class'],subtree:false});
    const root=document.getElementById('view-schedule');
    if(root) obs.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('[data-schedule-drag-toggle-v6059],[data-schedule-drag-scope-v6059]')) setTimeout(sync,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  window.__tuinbooksScheduleDragPolishBuild=BUILD;
})();

/* ===== END ORIGINAL schedule-drag-polish-v6064.js ===== */

/* ===== BEGIN ORIGINAL schedule-drag-basket-v6066.js ===== */
/* TuinBooks v60.7.42 — Drag Mode high-density staging basket + stable layout
   Loaded last. Normal Schedule remains unchanged when Drag Mode is off.
   - Docks a larger, high-density Schedule basket on the LEFT in Drag Mode.
   - Reuses the existing v59.3.20 selected-job Set without enabling duration-edit mode.
   - Calendar tickets get a small checkbox in Drag Mode.
   - Selected tickets can be sent to the basket with one action.
   - Dragging any selected ticket into the basket sends the selected group.
*/
(()=>{
  const BUILD='60.7.42-drag-mode-high-density-basket-stable-layout';
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
    try{return [...document.querySelectorAll('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart]')];}
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
      const tick=card.querySelector('.v59320-select-tick');
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
      const eligible=active&&(card.classList.contains('schedule-drag-enabled-v6061')||card.classList.contains('schedule-drag-enabled-v6059'));
      card.draggable=eligible;
      card.setAttribute('draggable',eligible?'true':'false');
    });
  }

  function basketDrawerV6084(){
    return document.getElementById('scheduleParkingLotV5537');
  }

  function basketRenderedV6084(){
    const drawer=basketDrawerV6084();
    return !!(drawer && !drawer.classList.contains('hidden') && drawer.querySelector('.schedule-basket-body-v58931'));
  }

  function requestBasketOpenV6084(){
    const drawer=basketDrawerV6084();
    if(!drawer)return false;
    try{window.openScheduleQueue?.();}catch(error){console.warn('[TuinBooks v60.8.4] Basket open request failed',error);}
    // A Schedule repaint can happen in the same turn as the click/mode change.
    // Re-assert the canonical open request after that repaint instead of
    // manufacturing a second basket DOM or maintaining a shadow basket state.
    requestAnimationFrame(()=>{
      if(basketRenderedV6084()){
        if(dragModeActive())ensureBulkTools();
        return;
      }
      try{window.openScheduleQueue?.();}catch(_){ }
      requestAnimationFrame(()=>{if(dragModeActive())ensureBulkTools();});
    });
    return true;
  }

  function openBasketForDragMode(){
    const drawer=basketDrawerV6084();
    if(!drawer)return;
    basketAutoOpened=!basketRenderedV6084();
    requestBasketOpenV6084();
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
        restoreBasketAfterDragMode();
      }
    }
    if(active){
      // Drag Mode owns a real staging basket. If any Schedule render cleared or
      // hid it while Drag Mode stayed active, restore the existing canonical
      // basket immediately. This is state reconciliation, not another renderer.
      if(!basketRenderedV6084())requestBasketOpenV6084();
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
        position:relative!important;
        left:auto!important;
        right:auto!important;
        top:auto!important;
        bottom:auto!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        height:min(620px,calc(100vh - 290px))!important;
        min-height:430px!important;
        max-height:620px!important;
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
        gap:4px!important;
        padding:5px 7px 7px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-drop-hint-v58930{
        padding:4px 6px!important;
        font-size:.59rem!important;
        line-height:1.05!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .control{
        min-height:26px!important;
        padding:4px 7px!important;
        font-size:.59rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-groups-v58930{
        display:grid!important;
        gap:4px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930{
        gap:2px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header{
        min-height:16px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header strong{
        font-size:.59rem!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>header small{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-group-v58930>div{
        gap:2px!important;
      }

      /* Dense basket rows: keep enough context to identify the client, but fit many names. */
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930{
        display:grid!important;
        grid-template-columns:15px minmax(0,1fr) 11px!important;
        min-height:23px!important;
        padding:2px 5px!important;
        gap:4px!important;
        border-radius:6px!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930 .basket-card-info-v58931{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .schedule-basket-card-v58930 .queue-work-marker{
        width:14px!important;
        height:14px!important;
        min-width:14px!important;
        font-size:.50rem!important;
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
        font-size:.64rem!important;
        line-height:1.0!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 .ui-pill{
        display:none!important;
      }
      body.schedule-drag-mode-active-v6061 #scheduleParkingLotV5537 .basket-card-main-v58930 small{
        display:block!important;
        margin-top:0!important;
        font-size:.49rem!important;
        line-height:1!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
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

      /* Standard Schedule launcher: preserve its exact appearance but guarantee
         that it stays above Schedule surfaces and receives pointer input. */
      body:not(.schedule-drag-mode-active-v6061):not(.schedule-drag-mode-active-v6059)
      #scheduleBasketLauncherV58931.schedule-basket-launcher-v58931:not(.hidden){
        pointer-events:auto!important;
        cursor:pointer!important;
        z-index:2147481000!important;
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
          min-height:20px!important;
          padding:1px 4px!important;
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
          height:360px!important;
          min-height:300px!important;
          max-height:360px!important;
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
    // Standard Schedule: own the visible green Basket strip click at the final
    // Schedule interaction layer. This avoids relying on a historical inline
    // onclick that may point at an older wrapper after a Schedule repaint.
    const launcher=event.target?.closest?.('#scheduleBasketLauncherV58931');
    if(launcher){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      requestBasketOpenV6084();
      return;
    }

    // When the floating basket is minimised, the whole header behaves like the
    // visible strip. The action buttons retain their existing behaviour.
    const minimisedHeader=event.target?.closest?.('#scheduleParkingLotV5537.minimised-v58931 .schedule-basket-head-v58930');
    if(minimisedHeader && !event.target?.closest?.('button,input,select,a')){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try{window.toggleScheduleBasketMinimisedV58931?.();}catch(_){ }
      return;
    }

    if(!dragModeActive())return;
    const selectAll=event.target?.closest?.('[data-v6065-select-all]');
    if(selectAll){event.preventDefault();event.stopImmediatePropagation();selectAllShown();return;}
    const clear=event.target?.closest?.('[data-v6065-clear]');
    if(clear){event.preventDefault();event.stopImmediatePropagation();clearSelection();return;}
    const send=event.target?.closest?.('[data-v6065-send-basket]');
    if(send){event.preventDefault();event.stopImmediatePropagation();moveIdsToBasket([...selectedSet()]);return;}
    const tick=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id] .v59320-select-tick');
    if(tick){
      event.preventDefault();event.stopImmediatePropagation();
      toggleSelected(String(tick.closest('.schedule-card-clean')?.dataset?.jobId||''));
      return;
    }
    const card=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart]');
    if(card&&(event.ctrlKey||event.metaKey)){
      event.preventDefault();event.stopImmediatePropagation();toggleSelected(String(card.dataset.jobId||''));
    }
  }

  function onKeyDown(event){
    if(!dragModeActive())return;
    const tick=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id] .v59320-select-tick');
    if(tick&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();event.stopImmediatePropagation();
      toggleSelected(String(tick.closest('.schedule-card-clean')?.dataset?.jobId||''));
      return;
    }
    if(event.key==='Escape'&&selectedSet().size){clearSelection({quiet:true});}
  }

  function onPointerDown(event){
    if(!dragModeActive())return;
    const tick=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id] .v59320-select-tick');
    if(tick){event.preventDefault();event.stopImmediatePropagation();return;}
    // The Drag Mode basket is docked, not a draggable floating utility window.
    const handle=event.target?.closest?.('#scheduleParkingLotV5537 .schedule-queue-move-handle');
    if(handle&&!event.target?.closest?.('button')){
      event.stopImmediatePropagation();
    }
  }

  function onDragStart(event){
    if(!dragModeActive())return;
    const card=event.target?.closest?.('#weeklyScheduleBoard .schedule-card-clean[data-job-id][ondragstart]');
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

/* ===== END ORIGINAL schedule-drag-basket-v6066.js ===== */
