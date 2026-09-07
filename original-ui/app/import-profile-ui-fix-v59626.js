(()=>{
  'use strict';
  const BUILD='59.6.26-single-billing-profile-control';

  function removePerRowBillingProfileControls(root=document){
    const host=root.querySelector?.('#spreadsheetImportRows')||document.querySelector('#spreadsheetImportRows');
    if(!host)return;

    // Known Billing Profile field injected by the older v59.3.96/v59.6.11 importer layer.
    host.querySelectorAll('[data-import-profile-v59396]').forEach(node=>node.remove());

    // Defensive fallback for an older cached renderer: remove only the importer
    // select whose change handler is the per-row Billing Profile assignment path.
    host.querySelectorAll('.detailed-import-grid-v5939 > label').forEach(label=>{
      const select=label.querySelector('select');
      const handler=String(select?.getAttribute('onchange')||'');
      const labelText=String(label.childNodes?.[0]?.textContent||label.textContent||'').trim();
      if(/^Billing Profile\b/i.test(labelText) && /updateSpreadsheetBillingProfileV59396/.test(handler)){
        label.remove();
      }
    });
  }

  function normaliseBulkAssignmentToolbar(){
    const toolbar=document.querySelector('#spreadsheetImportMeta .import-profile-bulk-v59610');
    if(!toolbar)return;

    const title=toolbar.querySelector('.import-profile-bulk-copy-v59610 strong');
    if(title)title.textContent='Assign Billing Profile';

    const copy=toolbar.querySelector('.import-profile-bulk-copy-v59610 span');
    if(copy && /matched|defaulted|unmatched|assign whole groups|need a Billing Profile/i.test(copy.textContent||'')){
      copy.textContent='Choose the spreadsheet group that needs an entity, choose the correct Billing Profile once, then apply it.';
    }

    const controls=toolbar.querySelector('.import-profile-bulk-controls-v59610');
    if(!controls)return;
    const labels=[...controls.querySelectorAll(':scope > label')];
    if(labels[0]){
      const text=[...labels[0].childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
      if(text)text.textContent='Spreadsheet rows';
    }
    if(labels[1]){
      const text=[...labels[1].childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
      if(text)text.textContent='Assign to';
    }
    const button=controls.querySelector('button');
    if(button)button.textContent='Apply';

    // Older builds defaulted to "Selected rows", which made unresolved Billing
    // Profile imports harder to understand. Prefer the unresolved spreadsheet
    // group (or all unresolved rows) when it is available.
    const target=controls.querySelector('#spreadsheetProfileBulkTargetV59610');
    if(target && target.value==='selected'){
      const options=[...target.options];
      const preferred=options.find(option=>String(option.value||'').startsWith('source:') && !option.disabled)
        || options.find(option=>option.value==='unmatched' && !option.disabled);
      if(preferred)target.value=preferred.value;
    }
  }

  function applyFix(){
    removePerRowBillingProfileControls();
    normaliseBulkAssignmentToolbar();
  }

  function install(){
    const dialog=document.querySelector('#spreadsheetImporterDialog');
    if(!dialog||dialog.dataset.singleProfileControlV59626==='1')return;
    dialog.dataset.singleProfileControlV59626='1';
    applyFix();

    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;applyFix();});
    });
    observer.observe(dialog,{childList:true,subtree:true});

    dialog.addEventListener('toggle',applyFix,true);
    dialog.addEventListener('click',event=>{
      if(event.target?.closest?.('.import-profile-bulk-v59610'))requestAnimationFrame(applyFix);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.__tuinbooksImportProfileUiFixV59626={build:BUILD,apply:applyFix};
})();
