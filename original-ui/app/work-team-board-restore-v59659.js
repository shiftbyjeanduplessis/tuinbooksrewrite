/* =========================================================
   TuinBooks v59.6.59 — Work team-board ownership restore
   ---------------------------------------------------------
   Purpose
   - Restore v59.6.54 "Today · team control" as the authoritative
     Recent Work renderer.
   - Keep the agreed Work tabs: Recent Work / Needs Review / All Work.
   - Remove the later Orders injection from Work.
   - Do not touch cloud save, Supabase hydration, schedules, billing,
     invoices, or the v59.6.58 Billing Profile repair.
   ========================================================= */
const TUINBOOKS_WORK_RESTORE_V59659='59.6.59-work-team-board-restore';

function removeOrdersFromWorkV59659(){
  document
    .querySelectorAll('#view-records [data-work-tab-v58930="orders"]')
    .forEach(node=>node.remove());
  const count=document.getElementById('ordersCountV58940');
  if(count?.closest('[data-work-tab-v58930="orders"]'))count.closest('[data-work-tab-v58930="orders"]').remove();
}

/* Stock-order data can continue to exist for quote fulfilment.
   It simply no longer owns a tab inside Work. */
try{
  ensureOrdersTabV58940=function ensureOrdersTabDisabledV59659(){
    removeOrdersFromWorkV59659();
  };
}catch(error){}

/* Any stale cached onclick from the removed Orders tab falls back safely. */
window.setWorkOrdersTabV58940=function setWorkOrdersTabDisabledV59659(){
  applyWorkTabV58930('recent');
};

function renderRecentWorkV59659(){
  renderWorkControlV59386({all:false});
  document.getElementById('needsResolutionV56')?.classList.add('hidden');
}

function renderAllWorkV59659(){
  renderWorkControlV59386({all:true});
  document.getElementById('needsResolutionV56')?.classList.add('hidden');
}

/* Make the restored team-board renderer the final owner. */
renderRecords=function renderRecordsV59659(){
  renderRecentWorkV59659();
};
renderAllWorkV58930=function renderAllWorkV59659Final(){
  renderAllWorkV59659();
};

applyWorkTabV58930=function applyWorkTabV59659(tab){
  const next=['recent','needs-review','all'].includes(String(tab||''))
    ? String(tab)
    : 'recent';

  workTabV58930=next;
  removeOrdersFromWorkV59659();

  setActiveSubtabV58930(
    '[data-work-tab-v58930]',
    next,
    'data-work-tab-v58930'
  );

  const view=document.getElementById('view-records');
  const inline=document.getElementById('needsReviewInlineV58930');
  const toolbar=view?.querySelector('.toolbar');
  const host=document.getElementById('workRecordCards');

  if(next==='needs-review'){
    /* Refresh the authoritative exception source, then show it only
       in the dedicated Needs Review tab. */
    renderWorkControlV59386({all:false});
    const source=document.getElementById('needsResolutionV56');

    if(inline){
      inline.innerHTML=
        source?.innerHTML||
        '<div class="ui-empty">No work needs an office decision.</div>';
      inline.classList.remove('hidden');
    }

    source?.classList.add('hidden');
    toolbar?.classList.add('hidden');
    host?.classList.add('hidden');
    return;
  }

  inline?.classList.add('hidden');
  toolbar?.classList.remove('hidden');
  host?.classList.remove('hidden');

  if(next==='all')renderAllWorkV59659();
  else renderRecentWorkV59659();
};

/* Defensive cleanup: quote initialisation can run at DOMContentLoaded. */
function initialiseWorkRestoreV59659(){
  removeOrdersFromWorkV59659();

  /* If Work is already the visible page, repaint it immediately.
     Otherwise normal navigation will call the restored owner. */
  if(document.getElementById('view-records')?.classList.contains('active')){
    applyWorkTabV58930(
      ['recent','needs-review','all'].includes(workTabV58930)
        ? workTabV58930
        : 'recent'
    );
  }

  window.__tuinbooksWorkTeamBoardBuild='59.6.54-work-team-operations-board';
  window.__tuinbooksWorkRestoreBuild=TUINBOOKS_WORK_RESTORE_V59659;
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initialiseWorkRestoreV59659);
}else{
  initialiseWorkRestoreV59659();
}
