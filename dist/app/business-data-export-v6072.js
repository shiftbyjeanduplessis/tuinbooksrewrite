/* TuinBooks v60.7.2 — isolated Business data export reliability fix */
(()=>{
'use strict';
const BUILD='60.7.2-business-data-export-reliability';
let running=false;
const runtime=()=>window.__tuinbooksOnboardingRuntimeV60423||null;
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const notify=(message,type='')=>{try{window.toast?.(message,type);}catch(_){} };
window.exportBusinessDataV56=function(){
  if(running){notify('A business data export is already being prepared.');return;}
  const state=runtime()?.getState?.();
  if(!state){notify('This business is still loading. Try the export again when loading has finished.','error');return;}
  const button=document.querySelector('#dataOwnershipV56 button[onclick*="exportBusinessDataV56"]');
  const original=button?.textContent||'Export business data';
  running=true;
  if(button){button.disabled=true;button.textContent='Preparing export…';}
  try{
    const payload={
      exportedAt:new Date().toISOString(),
      business:state.business,
      teams:state.teams,
      clusters:state.clusters,
      customers:state.clients,
      schedules:state.schedules,
      workRecords:state.visits,
      opportunities:state.opportunities,
      quotes:state.quotes,
      invoices:state.invoices,
      administrativeHistory:state.adminLifecycleV56
    };
    const text=JSON.stringify(payload,null,2);
    if(!text||text.length<100)throw new Error('The business backup was unexpectedly empty.');
    const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;
    a.download=`tuinbooks-business-export-${localDate()}.json`;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    notify('Business data export downloaded.','success');
  }catch(error){
    console.error('[TuinBooks business data export]',error);
    notify(`Business data export failed: ${error?.message||error}`,'error');
  }finally{
    running=false;
    if(button){button.disabled=false;button.textContent=original;}
  }
};
window.__tuinbooksBusinessDataExportBuild=BUILD;
})();
