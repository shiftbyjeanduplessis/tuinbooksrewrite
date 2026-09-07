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
