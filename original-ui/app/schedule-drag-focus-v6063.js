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
