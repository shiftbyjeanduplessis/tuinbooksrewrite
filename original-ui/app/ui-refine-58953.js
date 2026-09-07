/* TuinBooks v58.9.53 — compact quote/contact layout and page cleanup */
(function(){
  'use strict';
  const BUILD='58.9.53-compact-quote-billing-cleanup';
  const byId=id=>document.getElementById(id);

  function installStyles(){
    if(byId('tuinbooksStylesV58953'))return;
    const style=document.createElement('style');
    style.id='tuinbooksStylesV58953';
    style.textContent=`
      /* Remove only the two legacy Billing summary blocks requested. */
      #billingTimingAlertV5545 > .billing-timing-alert-v5545:not(.v56-missing-draft),
      #billingTimingAlertV5545 > .billing-ageing-strip-v5545{display:none!important}
      #billingTimingAlertV5545:empty{display:none!important}

      /* Keep the quote header compact: contact, date and note share one row. */
      #quoteEditorForm .quote-top-grid-v58953{
        display:grid!important;
        grid-template-columns:minmax(330px,1.45fr) minmax(170px,.62fr) minmax(260px,1fr)!important;
        gap:12px!important;
        align-items:end!important;
      }
      #quoteEditorForm .quote-top-grid-v58953>label{min-width:0;margin:0}
      #quoteEditorForm .quote-contact-inline-v58953{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        gap:8px!important;
        align-items:center!important;
        width:100%!important;
      }
      #quoteEditorForm .quote-contact-inline-v58953 select{min-width:0;width:100%}
      #quoteEditorForm .quote-contact-inline-v58953 .button{white-space:nowrap;height:42px}
      #quoteEditorForm .quote-contact-summary-v58953{
        display:block;min-height:16px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      #quoteEditorForm .quote-note-label-v58953 textarea{
        min-height:42px!important;height:42px!important;max-height:42px!important;
        resize:none!important;padding-top:10px!important;padding-bottom:10px!important;
      }
      #quoteEditorForm .optional-inline-v58953{font-weight:400;color:var(--muted,#66766f);font-size:.8em}
      @media(max-width:980px){
        #quoteEditorForm .quote-top-grid-v58953{grid-template-columns:minmax(0,1fr) minmax(170px,.55fr)!important}
        #quoteEditorForm .quote-note-label-v58953{grid-column:1/-1}
      }
      @media(max-width:700px){
        #quoteEditorForm .quote-top-grid-v58953{grid-template-columns:1fr!important}
        #quoteEditorForm .quote-note-label-v58953{grid-column:auto}
        #quoteEditorForm .quote-contact-inline-v58953{grid-template-columns:minmax(0,1fr) auto!important}
      }
    `;
    document.head.appendChild(style);
  }

  function removeUnclusteredWarning(){
    const host=byId('scheduleActionAlerts');
    if(!host)return;
    [...host.querySelectorAll('.schedule-action-alert')].forEach(node=>{
      if(/\bjobs? without a cluster\b/i.test(node.textContent||''))node.remove();
    });
    const visible=[...host.children].some(node=>getComputedStyle(node).display!=='none');
    host.classList.toggle('hidden',!visible);
  }

  function cleanBillingBlocks(){
    const host=byId('billingTimingAlertV5545');
    if(!host)return;
    host.querySelectorAll('.billing-timing-alert-v5545:not(.v56-missing-draft),.billing-ageing-strip-v5545').forEach(node=>node.remove());
    if(!host.children.length)host.style.display='none';
    else host.style.removeProperty('display');
  }

  function ensureQuoteContactControl(){
    const select=byId('quoteClient');
    if(!select)return;
    const label=select.closest('label');
    if(label){
      const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||'').trim());
      if(textNode)textNode.textContent='Client or contact ';
    }
    let row=byId('quoteContactPickerRowV58951');
    if(!row){
      row=document.createElement('div');
      row.id='quoteContactPickerRowV58951';
      row.className='quote-contact-picker-row-v58951 quote-contact-inline-v58953';
      select.parentNode.insertBefore(row,select);
      row.appendChild(select);
    }
    row.classList.add('quote-contact-inline-v58953');
    let button=[...row.querySelectorAll('button')].find(item=>/contact/i.test(item.textContent||''));
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='button secondary compact';
      row.appendChild(button);
    }
    button.textContent='+ Contact';
    button.onclick=()=>{
      if(typeof window.openQuoteContactDialogV58951==='function')window.openQuoteContactDialogV58951();
      else if(typeof window.toast==='function')window.toast('The contact form is still loading. Please try again.','error');
    };
    select.onchange=()=>{
      if(typeof window.refreshQuoteContactSelectionV58951==='function')window.refreshQuoteContactSelectionV58951();
    };
    let summary=byId('quoteContactPickerSummaryV58951');
    if(!summary&&label){
      summary=document.createElement('small');summary.id='quoteContactPickerSummaryV58951';row.insertAdjacentElement('afterend',summary);
    }
    summary?.classList.add('quote-contact-summary-v58953');
  }

  function compactQuoteTopRow(){
    const form=byId('quoteEditorForm'),notes=byId('quoteNotes');
    if(!form||!notes)return;
    const grid=notes.closest('.form-grid');
    if(grid)grid.classList.add('quote-top-grid-v58953');
    const label=notes.closest('label');
    if(label){
      label.classList.remove('span-two');label.classList.add('quote-note-label-v58953');
      const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||'').trim());
      if(textNode)textNode.textContent='Quote note ';
      if(!label.querySelector('.optional-inline-v58953')){
        const optional=document.createElement('span');optional.className='optional-inline-v58953';optional.textContent='optional';label.insertBefore(optional,notes);
      }
    }
    notes.rows=1;notes.placeholder='Short note for the client';
    ensureQuoteContactControl();
  }

  let queued=false;
  function refresh(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{
      queued=false;installStyles();compactQuoteTopRow();removeUnclusteredWarning();cleanBillingBlocks();
    });
  }

  function initialise(){
    refresh();
    ['scheduleActionAlerts','billingTimingAlertV5545','quoteEditorDialog'].forEach(id=>{
      const node=byId(id);if(node)new MutationObserver(refresh).observe(node,{childList:true,subtree:true});
    });
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-view="quotes"],#newQuoteBtn,.quote-row-v58940,button'))setTimeout(refresh,0);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialise);
  else initialise();
  window.__tuinbooksV58953Test={build:BUILD,refresh,removeUnclusteredWarning,cleanBillingBlocks,compactQuoteTopRow};
})();
