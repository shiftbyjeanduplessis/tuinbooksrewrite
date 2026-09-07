/* TuinBooks v60.6.1 — harden activated Schedule drag mode
   Loaded last, after the frozen schedule renderer and card-layout repair.
   Owns the visible Drag mode state and synchronises it to the actual cards. */
(()=>{
  const TUINBOOKS_STAGE1_DRAGMODE_SOURCE_V6085='60.8.5-stage1-qwen-repair';
  const BUILD='60.7.45-drag-toggle-single-owner';
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
    try{return [...document.querySelectorAll('#view-schedule .schedule-card-clean.v6059-minimal-card[ondragstart], #view-schedule .v6006-job[data-job-id][ondragstart]')];}
    catch(_){return [];}
  }

  function syncCards(){
    syncQueued=false;
    document.body?.classList.toggle('schedule-drag-mode-active-v6059',active);
    document.body?.classList.toggle('schedule-drag-mode-active-v6061',active);

    movableCards().forEach(card=>{
      card.draggable=true;
      card.setAttribute('draggable','true');card.draggable=true;
      card.classList.toggle('schedule-drag-enabled-v6059',active);
      card.classList.toggle('schedule-drag-enabled-v6061',active);
    });

    // Cards that are not genuine movable visits must always stay locked.
    try{
      document.querySelectorAll('#view-schedule .schedule-card-clean.v6059-minimal-card:not([ondragstart]), #view-schedule .v6006-job[data-job-id]:not([ondragstart])').forEach(card=>{
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

  // Click ownership is intentionally left to app.js. It already delegates the
  // Drag Mode + scope controls and calls the public hooks above. A second
  // document click listener here caused the same click to toggle ON and then
  // immediately toggle OFF on the next task.

  // Hard safety gate: no Schedule card can begin a drag while Drag mode is off.
  document.addEventListener('dragstart',event=>{
    const card=event.target?.closest?.('#view-schedule [ondragstart]');
    if(card&&!document.body?.classList.contains('schedule-drag-mode-active-v6061')&&!document.body?.classList.contains('schedule-drag-mode-active-v6059')){
      try{window.setScheduleDragScopeV6059?.('once');}catch(_){}
    }
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

  window.__tuinbooksScheduleDragModeBuild='60.7.45-drag-toggle-single-owner';
  window.__tuinbooksBuild=BUILD;
})();
