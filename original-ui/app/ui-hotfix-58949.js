/* TuinBooks v58.9.49 — sticky Rolling operations + Billing Drafts repair */
(function(){
  'use strict';

  const BUILD='58.9.49-sticky-operations-billing-drafts';
  const byId=(id)=>document.getElementById(id);

  function repairedApplyBillingTabV58949(tab){
    billingTabV58930=tab||'all';
    setActiveSubtabV58930('[data-billing-tab-v58930]',billingTabV58930,'data-billing-tab-v58930');

    const billingView=byId('view-invoices');
    const draftSection=byId('invoiceDraftQueue')?.closest('.section-block');
    const sentSection=byId('alreadyInvoicedSection');
    const noWorkSection=byId('noWorkSection');

    // The previous code used closest('section') for Already invoiced. That selected
    // the whole Billing view and hid the entire page when Drafts was clicked.
    billingView?.classList.remove('hidden');
    draftSection?.classList.toggle('hidden',!['drafts','all'].includes(billingTabV58930));
    sentSection?.classList.toggle('hidden',billingTabV58930==='drafts');
    noWorkSection?.classList.toggle('hidden',billingTabV58930!=='all');

    if(sentSection&&['sent','overdue','paid'].includes(billingTabV58930))sentSection.open=true;

    const month=byId('invoiceMonth')?.value||currentMonth();
    const invoices=(state.invoices||[])
      .filter(inv=>inv.month===month&&inv.status!=='Credited')
      .filter(inv=>invoiceDeliveryStatus(inv)==='Sent'||(invoicePaymentStatus(inv)==='Paid'&&inv.number&&inv.number!=='Draft'));

    [...document.querySelectorAll('#alreadyInvoicedList > details.invoiced-item')].forEach((node,index)=>{
      const invoice=invoices[index];
      if(!invoice)return;
      node.dataset.recordId=invoice.id;
      const group=invoicePaymentGroupV58930(invoice);
      node.classList.toggle('hidden',billingTabV58930!=='all'&&group!==billingTabV58930);
      const actions=node.querySelector('.invoice-actions');
      if(actions&&!actions.querySelector('.history-action-v58930')){
        actions.insertAdjacentHTML('beforeend',`<button class="button secondary history-action-v58930" onclick="openRecordHistoryV58930('invoice','${invoice.id}')">History</button>`);
      }
    });

    const draftQueue=byId('invoiceDraftQueue');
    if(draftQueue&&['drafts','all'].includes(billingTabV58930)&&!draftQueue.innerHTML.trim()){
      draftQueue.innerHTML='<div class="panel"><strong>No invoice drafts.</strong><p>Completed work that is ready for billing will appear here.</p></div>';
    }
  }

  // Replace the global function used by Billing renders and existing click handlers.
  try{ applyBillingTabV58930=repairedApplyBillingTabV58949; }catch(error){ /* global fallback below */ }
  window.applyBillingTabV58930=repairedApplyBillingTabV58949;

  function initialiseV58949(){
    byId('rollingScheduleOverview')?.classList.add('rolling-plan-frozen-v58949');
    if(byId('view-invoices')?.classList.contains('active')){
      renderInvoiceCentre();
      repairedApplyBillingTabV58949(billingTabV58930||'all');
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialiseV58949);
  else initialiseV58949();

  window.__tuinbooksV58949Test={
    build:BUILD,
    rollingOperationsSticky:true,
    billingDraftsDoesNotHideBillingView:true,
    billingSentContainerUsesDetailsElement:true
  };
})();
