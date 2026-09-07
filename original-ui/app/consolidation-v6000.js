/* =========================================================
   TuinBooks v60.0.0 — consolidation CANARY controller
   ---------------------------------------------------------
   Safety goals for Stage 0:
   - Never load from the production index.html.
   - Never register/replace the production service worker.
   - Use a separate app-consolidated-v6000.js file.
   - Do not run migrations or mutate tenant data beyond the existing app's
     normal behaviour; this controller itself is diagnostic-only.
   - Give us a stable URL for page-by-page consolidation and regression tests.
   ========================================================= */
(() => {
  'use strict';
  const BUILD='60.0.0-consolidation-canary';
  if(!window.__TUINBOOKS_CONSOLIDATION_CANARY__) return;

  function addStatus(){
    if(document.querySelector('.tuinbooks-canary-status-v6000')) return;
    const el=document.createElement('div');
    el.className='tuinbooks-canary-status-v6000';
    const loaded=[
      ['Schedule',typeof window.renderSchedule==='function'],
      ['Work',typeof window.renderRecords==='function'],
      ['Clients',typeof window.renderClients==='function'],
      ['Quotes',typeof window.renderQuotes==='function'],
      ['Billing',typeof window.renderInvoiceCentre==='function'],
      ['Business',typeof window.renderSettings==='function']
    ];
    const ok=loaded.filter(([,v])=>v).length;
    el.innerHTML=`<strong>v60 canary</strong> · ${ok}/${loaded.length} page bindings visible · production index untouched`;
    document.body.appendChild(el);
  }

  function snapshot(){
    const rows={
      build:BUILD,
      href:location.href,
      activeView:window.activeView||'',
      hasState:!!window.state,
      renderers:{
        schedule:typeof window.renderSchedule,
        work:typeof window.renderRecords,
        clients:typeof window.renderClients,
        quotes:typeof window.renderQuotes,
        billing:typeof window.renderInvoiceCentre,
        business:typeof window.renderSettings
      },
      dom:{
        schedule:!!document.getElementById('view-schedule'),
        work:!!document.getElementById('view-records'),
        clients:!!document.getElementById('view-clients'),
        quotes:!!document.getElementById('view-quotes'),
        billing:!!document.getElementById('view-invoices'),
        business:!!document.getElementById('view-settings')
      }
    };
    window.__tuinbooksConsolidationSnapshotV6000=rows;
    return rows;
  }

  function boot(){
    snapshot();
    addStatus();
    document.documentElement.dataset.tuinbooksCanary='v6000';
    console.info('[TuinBooks consolidation canary]',window.__tuinbooksConsolidationSnapshotV6000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));
  else setTimeout(boot,0);
})();
