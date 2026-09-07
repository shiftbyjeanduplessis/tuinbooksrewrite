/* TuinBooks v60.3.1 PRODUCTION — completed-work recurring billing
   Billing rule:
   - routine control drafts still show the full expected cycle value
   - only completed routine work inside that billing cycle becomes invoiceable
   - missed work is not billed and is not automatically carried into the next cycle
   - catch-up jobs whose original missed date belongs to a previous cycle are excluded
   - unissued routine drafts only; issued accounting documents are never rewritten
*/
(()=>{
  'use strict';

  const BUILD='60.3.1-completed-work-billing-nav-rate-fix-production';
  const state=()=>window.state||{};
  const round2=value=>Math.round((Number(value)||0)*100)/100;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
  const today=()=>{
    if(typeof window.localDateISO==='function')return window.localDateISO();
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const money=value=>{
    if(typeof window.money==='function')return window.money(value);
    const n=round2(value),abs=Math.abs(n).toLocaleString('en-ZA',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2});
    return `${n<0?'-':''}R ${abs}`;
  };
  const fmt=value=>{
    if(typeof window.fmtDate==='function')return window.fmtDate(value);
    const d=new Date(`${dateOnly(value)}T12:00:00`);return Number.isNaN(d.getTime())?String(value||''):d.toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
  };

  function clientFor(id){return (state().clients||[]).find(row=>String(row.id)===String(id))||{};}
  function scheduleFor(id){return (state().schedules||[]).find(row=>String(row.id)===String(id))||null;}
  function invoiceFor(id){return (state().invoices||[]).find(row=>String(row.id)===String(id))||null;}

  function issued(invoice){
    if(!invoice)return false;
    const status=String(invoice.status||'').toLowerCase();
    return Boolean(invoice.issuedAtV59400||invoice.sentAt||invoice.commercialStateV59400==='issued'||['sent','issued','paid','credited'].includes(status));
  }
  function routineDraft(invoice){return Boolean(invoice?.routineControlDraftV59660===true&&!issued(invoice));}

  function bounds(invoice){
    let start=dateOnly(invoice?.billingCycleStartV59659),end=dateOnly(invoice?.billingCycleEndV59659);
    const month=String(invoice?.month||'').slice(0,7);
    if((!start||!end)&&/^\d{4}-\d{2}$/.test(month)){
      const [year,number]=month.split('-').map(Number),last=new Date(year,number,0,12).getDate();
      start=start||`${month}-01`;end=end||`${month}-${String(last).padStart(2,'0')}`;
    }
    return {start,end};
  }

  function completedVisit(visit){
    if(!visit)return false;
    const value=String(visit.outcome||visit.status||'').trim().toLowerCase();
    return value==='completed'||/^completed\b/.test(value)||/catch[\s_-]*up[\s_-]*completed/.test(value);
  }

  function carryoverFromEarlierCycle(visit,cycle){
    const job=visit?.scheduledJobId?scheduleFor(visit.scheduledJobId):null;
    if(!job)return false;
    const original=dateOnly(job.originalMissedDateV58931||job.originalMissedDate||job.originalDate||'');
    return Boolean(original&&cycle.start&&original<cycle.start);
  }

  function eligibleCompletedVisits(invoice){
    const cycle=bounds(invoice),clientId=String(invoice.clientId||'');
    if(!cycle.start||!cycle.end||!clientId)return {all:[],billable:[],excludedCarryover:[]};
    const all=[],excludedCarryover=[];
    for(const visit of state().visits||[]){
      if(String(visit?.clientId||'')!==clientId||!completedVisit(visit))continue;
      const date=dateOnly(visit.date||visit.completedAt||visit.createdAt);if(!date||date<cycle.start||date>cycle.end)continue;
      const job=visit.scheduledJobId?scheduleFor(visit.scheduledJobId):null;
      if(job&&(job.quoteId||String(job.workKind||'').toLowerCase()==='once-off'||String(job.revenueType||'').toLowerCase().includes('once-off')))continue;
      if(carryoverFromEarlierCycle(visit,cycle)){excludedCarryover.push(visit);continue;}
      all.push(visit);
    }
    all.sort((a,b)=>dateOnly(a.date).localeCompare(dateOnly(b.date))||String(a.id||'').localeCompare(String(b.id||'')));
    const expected=Math.max(0,Number(invoice.routineExpectedVisitCountV59660||0));
    return {all,billable:expected>0?all.slice(0,expected):[],excludedCarryover};
  }

  function positive(...values){
    return values.map(Number).find(value=>Number.isFinite(value)&&value>0)||0;
  }

  function agreementFor(clientId){
    return (state().serviceAgreements||[]).find(row=>String(row?.clientId||'')===String(clientId||'')&&String(row?.status||'Active').toLowerCase()==='active')||
      (state().serviceAgreements||[]).find(row=>String(row?.clientId||'')===String(clientId||''))||{};
  }

  function pricing(client,invoice){
    const line=primaryRoutineLine(invoice)||{};
    const agreement=agreementFor(client?.id||invoice?.clientId);
    const arrangement=`${client.billingArrangement||''} ${client.priceBasis||''} ${agreement.billingArrangement||''}`.toLowerCase();
    let mode=String(invoice.billingPricingModeV59659||'').toLowerCase();
    if(!['monthly_fixed','per_visit'].includes(mode)){
      if(/monthly fixed|fixed fee|listed amount|monthly fee/.test(arrangement)||positive(client.monthlyFee,agreement.monthlyFee)>0)mode='monthly_fixed';
      else mode='per_visit';
    }

    // Important recovery rule: v60.3.0 must never erase a rate already captured
    // on the routine draft merely because one hydrated client copy is missing it.
    // v59.6.60 stored agreedVisitRateV59660 on per-visit control lines.
    const perVisit=positive(
      client.rateAmount,client.perVisitRate,client.visitRate,
      agreement.rateAmount,agreement.perVisitRate,agreement.visitRate,
      invoice.agreedVisitRateV59660,line.agreedVisitRateV59660,
      line.billingRateV59659,
      (mode==='per_visit'&&Number(line.unitPrice||0)>0)?line.unitPrice:0
    );
    const monthly=positive(
      client.monthlyFee,
      /monthly fixed|fixed fee|listed amount|monthly fee/.test(arrangement)?client.rateAmount:0,
      agreement.monthlyFee,invoice.agreedMonthlyAmountV59660,line.agreedMonthlyAmountV59660,
      (mode==='monthly_fixed'&&Number(line.unitPrice||0)>0)?line.unitPrice:0
    );
    return {mode,perVisit:round2(perVisit),monthly:round2(monthly)};
  }

  function vatRate(invoice){
    const explicit=Number(invoice?.vatRate);if(Number.isFinite(explicit))return explicit;
    return String(state().business?.vatRegistered||'no').toLowerCase()==='yes'?Number(state().business?.vatRate||15):0;
  }
  function gross(subtotal,invoice){return round2(Number(subtotal||0)*(1+vatRate(invoice)/100));}
  function lineTotal(line){return round2(Number(line?.qty||0)*Number(line?.unitPrice||0));}
  function invoiceTotal(invoice){const subtotal=(invoice?.lineItems||[]).reduce((sum,line)=>sum+lineTotal(line),0);return gross(subtotal,invoice);}

  function primaryRoutineLine(invoice){
    return (invoice.lineItems||[]).find(line=>line?.routineControlV59660===true||line?.sourceType==='recurring-contract'||String(line?.sourceKey||'').startsWith('contract:'))||null;
  }
  function serviceLabel(client,line){
    const fromLine=String(line?.description||'').split('—')[0].trim();
    return String(client.serviceDescription||client.serviceName||fromLine||'Routine garden service').trim();
  }
  function rangeLabel(cycle){return cycle.start&&cycle.end?`${fmt(cycle.start)} – ${fmt(cycle.end)}`:'';}

  function unresolvedExtra(invoice){return (invoice.lineItems||[]).some(line=>line?.extra===true&&(line.approved!==true||Number(line.unitPrice||0)<=0));}

  function reconcileInvoice(invoice){
    if(!routineDraft(invoice))return false;
    const before=JSON.stringify({lineItems:invoice.lineItems,total:invoice.total,status:invoice.status,sendable:invoice.sendableStatusV59379,review:invoice.needsOfficeReview,reason:invoice.reviewReason,meta:[invoice.routineExpectedValueV6030,invoice.routineCompletedValueV6030,invoice.routineMissedValueV6030,invoice.routineInvoiceableValueV6030,invoice.routineBillableVisitCountV6030]});
    const client=clientFor(invoice.clientId),cycle=bounds(invoice),expected=Math.max(0,Number(invoice.routineExpectedVisitCountV59660||0));
    const visits=eligibleCompletedVisits(invoice),rawCompleted=visits.all.length,billableCompleted=visits.billable.length,missing=Math.max(0,expected-billableCompleted);
    const price=pricing(client,invoice),line=primaryRoutineLine(invoice);
    const baseRate=price.mode==='monthly_fixed'?price.monthly:price.perVisit;
    const expectedSubtotal=price.mode==='monthly_fixed'?price.monthly:round2(expected*price.perVisit);
    const completedSubtotal=price.mode==='monthly_fixed'?(expected>0?round2(price.monthly*(billableCompleted/expected)):0):round2(billableCompleted*price.perVisit);

    if(line){
      line.routineControlV59660=true;
      line.expectedVisitsV59660=expected;
      line.completedVisitsV6030=billableCompleted;
      line.rawCompletedVisitsV6030=rawCompleted;
      line.billingModelV6030='completed-work-only';
      if(price.mode==='per_visit'&&price.perVisit>0)line.agreedVisitRateV59660=price.perVisit;
      if(price.mode==='monthly_fixed'&&price.monthly>0)line.agreedMonthlyAmountV59660=price.monthly;
      line.description=`${serviceLabel(client,line)} — ${billableCompleted} completed of ${expected||'unresolved'} expected${rangeLabel(cycle)?` · ${rangeLabel(cycle)}`:''}`;
      if(price.mode==='monthly_fixed'){
        line.qty=1;line.unitPrice=completedSubtotal;
      }else{
        line.qty=billableCompleted>0?billableCompleted:1;line.unitPrice=billableCompleted>0?price.perVisit:0;
      }
      line.approved=expected>0&&baseRate>0&&billableCompleted>0;
    }

    // Only source-managed extras tied to billable completed visits remain in the
    // routine draft. Manually-added invoice lines are deliberately preserved.
    const billableVisitIds=new Set(visits.billable.map(visit=>String(visit.id||'')));
    invoice.lineItems=(invoice.lineItems||[]).filter(item=>{
      if(item===line)return true;
      if(item?.sourceManaged===true&&item?.extra===true&&item?.sourceVisitId){return billableVisitIds.has(String(item.sourceVisitId));}
      return true;
    });

    const expectedValue=gross(expectedSubtotal,invoice),completedValue=gross(completedSubtotal,invoice),missedValue=round2(Math.max(0,expectedValue-completedValue));
    invoice.billingModelV6030='completed-work-only';
    invoice.routineExpectedValueV6030=expectedValue;
    invoice.routineCompletedValueV6030=completedValue;
    invoice.routineMissedValueV6030=missedValue;
    invoice.routineBillableVisitCountV6030=billableCompleted;
    invoice.routineRawCompletedVisitCountV6030=rawCompleted;
    invoice.routineExcludedCarryoverCountV6030=visits.excludedCarryover.length;
    invoice.routineCompletedVisitCountV59660=billableCompleted;
    invoice.routineMissingVisitCountV59660=missing;
    invoice.routineInvoiceableValueV6030=invoiceTotal(invoice);
    invoice.total=invoice.routineInvoiceableValueV6030;

    const cycleClosed=Boolean(cycle.end&&today()>=cycle.end);
    invoice.billingMissingVisitWarningV59383=missing>0
      ?`${billableCompleted} of ${expected} expected routine visits completed. ${missing} ${cycleClosed?'missed and not invoiced':'not yet completed'}. Missed work is not carried into the next billing cycle.`
      :expected>0?'All expected routine visits for this billing cycle are completed.':'';
    invoice.billingMissingVisitCountV59383=missing;

    const setupIncomplete=expected<=0||baseRate<=0;
    const extraReview=unresolvedExtra(invoice);
    if(setupIncomplete){
      invoice.needsOfficeReview=true;
      invoice.reviewReason=expected<=0?'Routine recurrence/schedule is incomplete. Confirm the expected visits before invoicing.':'Rate missing — enter the agreed client rate before issue.';
      invoice.status='Draft';invoice.sendableStatusV59379='blocked';
    }else if(extraReview){
      invoice.needsOfficeReview=true;invoice.reviewReason='Price and approve the captured extra before sending.';invoice.status='Draft';invoice.sendableStatusV59379='blocked';
    }else if(billableCompleted<=0){
      invoice.needsOfficeReview=cycleClosed;
      invoice.reviewReason=cycleClosed?'No completed routine work in this billing cycle. Nothing is invoiceable.':'';
      invoice.status='Draft';invoice.sendableStatusV59379=cycleClosed?'blocked':'not_due';
    }else{
      // Missing visits do not block issue: the invoice is deliberately for the
      // completed portion only. Existing send-date logic still controls when it
      // becomes Ready.
      if(String(invoice.reviewReason||'').match(/rate missing|routine recurrence|no completed routine work|full agreed amount/i))invoice.reviewReason='';
      if(!invoice.reviewReason)invoice.needsOfficeReview=false;
      const sendDate=dateOnly(invoice.invoiceByDate||invoice.availableToIssueDateV59383||invoice.invoiceCycleDateV59383||invoice.issueDate);
      const due=!sendDate||today()>=sendDate;
      invoice.status=due?'Ready':'Draft';invoice.sendableStatusV59379=due?'sendable':'not_due';
    }

    const after=JSON.stringify({lineItems:invoice.lineItems,total:invoice.total,status:invoice.status,sendable:invoice.sendableStatusV59379,review:invoice.needsOfficeReview,reason:invoice.reviewReason,meta:[invoice.routineExpectedValueV6030,invoice.routineCompletedValueV6030,invoice.routineMissedValueV6030,invoice.routineInvoiceableValueV6030,invoice.routineBillableVisitCountV6030]});
    if(before!==after){invoice.updatedAt=new Date().toISOString();return true;}
    return false;
  }

  function reconcileAll({save=false}={}){
    let changed=false,count=0;
    for(const invoice of state().invoices||[]){if(routineDraft(invoice)){count++;changed=reconcileInvoice(invoice)||changed;}}
    if(changed&&save){try{window.save?.();}catch(error){console.error('[v60.3.1] billing save failed',error);}}
    return {changed,count};
  }

  function stripFor(invoice){
    const expected=Number(invoice.routineExpectedValueV6030||0),completed=Number(invoice.routineCompletedValueV6030||0),missed=Number(invoice.routineMissedValueV6030||0),final=Number(invoice.routineInvoiceableValueV6030??invoiceTotal(invoice));
    const cycle=bounds(invoice),closed=Boolean(cycle.end&&today()>=cycle.end),missing=Math.max(0,Number(invoice.routineExpectedVisitCountV59660||0)-Number(invoice.routineBillableVisitCountV6030||0));
    return `<div class="billing-earned-strip-v6030"><span><small>Expected</small><strong>${money(expected)}</strong></span><span><small>Completed</small><strong>${money(completed)}</strong></span><span class="${missing?'warning':''}"><small>${closed?'Missed':'Not completed'}</small><strong>${money(missed)}</strong></span><span class="invoice"><small>Invoice</small><strong>${money(final)}</strong></span></div>${invoice.routineExcludedCarryoverCountV6030?`<small class="billing-no-carry-v6030">${invoice.routineExcludedCarryoverCountV6030} previous-cycle catch-up ${invoice.routineExcludedCarryoverCountV6030===1?'visit':'visits'} excluded — no automatic carry-forward.</small>`:''}`;
  }

  function idFromRow(row){const raw=String(row?.getAttribute('onclick')||'');return raw.match(/openCommercialInvoiceV59400\('([^']+)'\)/)?.[1]||'';}

  let initialStageChosenV6031=false;
  function chooseInitialBillingStageV6031(){
    if(initialStageChosenV6031)return;
    initialStageChosenV6031=true;
    try{
      if(typeof commercialBillingStageV59400==='undefined'||commercialBillingStageV59400==='payments')return;
      const counts=typeof commercialBillingCountsV59400==='function'?commercialBillingCountsV59400():null;
      if(!counts)return;
      // Do not land the office on the unresolved-rate queue by default.
      // Show genuinely invoiceable work first; Needs attention remains one click away.
      if(Number(counts.ready||0)>0)commercialBillingStageV59400='ready';
      else if(Number(counts.later||0)>0)commercialBillingStageV59400='later';
      else if(Number(counts.attention||0)>0)commercialBillingStageV59400='attention';
    }catch(_){ }
  }

  function rateCoverageV6031(){
    const clients=(state().clients||[]).filter(client=>{
      const status=String(client?.status||'active').toLowerCase();
      return status==='active'&&String(client?.recordKindV58951||'').toLowerCase()!=='quote-contact';
    });
    let known=0,missing=0;
    for(const client of clients){
      const draft=(state().invoices||[]).find(invoice=>String(invoice?.clientId||'')===String(client.id)&&routineDraft(invoice));
      if(!draft)continue;
      const price=pricing(client,draft),rate=price.mode==='monthly_fixed'?price.monthly:price.perVisit;
      if(rate>0)known++;else missing++;
    }
    return {known,missing,total:known+missing};
  }

  function applyUi(){
    const drafts=(state().invoices||[]).filter(routineDraft);
    if(!drafts.length)return;
    const summary=document.getElementById('billingSummaryV58952');
    if(summary){
      const sums=drafts.reduce((acc,invoice)=>{acc.expected+=Number(invoice.routineExpectedValueV6030||0);acc.completed+=Number(invoice.routineCompletedValueV6030||0);acc.missed+=Number(invoice.routineMissedValueV6030||0);acc.invoice+=Number(invoice.routineInvoiceableValueV6030??invoiceTotal(invoice));return acc;},{expected:0,completed:0,missed:0,invoice:0});
      summary.classList.add('billing-summary-earned-v6030');
      summary.innerHTML=[['Expected',money(sums.expected),'Routine value planned for these cycles'],['Completed',money(sums.completed),'Routine work actually completed'],['Not completed',money(sums.missed),'Not invoiceable'],['Invoiceable',money(sums.invoice),'Completed work + approved extras']].map(([label,value,small])=>`<article class="billing-control-card-v59663"><span>${label}</span><strong>${value}</strong><small>${small}</small></article>`).join('');
    }

    const heading=document.querySelector('#view-invoices .billing-heading-v58952');
    const intro=heading?.querySelector('p');if(intro)intro.textContent='Expected routine drafts are created automatically. Only completed work becomes invoiceable; missed work is not carried forward.';
    const warning=document.getElementById('billingWorkCheckV59662');
    if(warning){
      const strong=warning.querySelector('strong'),span=warning.querySelector('span');
      if(strong)strong.textContent='Routine billing checks';
      if(span)span.textContent='Only completed work is invoiceable. Missing rates stay in Needs attention; missed work is not carried forward.';
      const coverage=rateCoverageV6031();
      let rates=warning.querySelector('.billing-rate-coverage-v6031');
      if(!rates){rates=document.createElement('small');rates.className='billing-rate-coverage-v6031';warning.appendChild(rates);}
      rates.textContent=coverage.total?`${coverage.known} routine clients have an agreed rate · ${coverage.missing} still need a rate`:'';
    }

    const stageHost=document.getElementById('commercialBillingStagesV59400');
    stageHost?.querySelectorAll('[data-commercial-billing-stage]').forEach(button=>{
      const stage=button.getAttribute('data-commercial-billing-stage');
      const label=button.querySelector('span');
      if(stage==='attention'&&label)label.textContent='Needs rate / setup';
      if(stage==='later'&&label)label.textContent='Routine drafts';
    });

    document.querySelectorAll('.billing-row-v59400').forEach(row=>{
      const invoice=invoiceFor(idFromRow(row));if(!routineDraft(invoice))return;
      row.querySelector('.billing-earned-strip-v6030')?.remove();row.querySelector('.billing-no-carry-v6030')?.remove();
      const main=row.querySelector('.commercial-row-main-v59400');if(main)main.insertAdjacentHTML('beforeend',stripFor(invoice));
    });

    const selected=document.querySelector('.billing-row-v59400.selected'),selectedInvoice=invoiceFor(idFromRow(selected));
    const detail=document.querySelector('#billingInvoiceDetailV58952 .commercial-invoice-workspace-v59400');
    if(detail&&routineDraft(selectedInvoice)){
      detail.querySelector('.billing-earned-detail-v6030')?.remove();
      detail.querySelector('.monthly-reconcile-v59400')?.remove();
      const status=detail.querySelector('.commercial-invoice-status-grid-v59400');
      status?.insertAdjacentHTML('afterend',`<section class="billing-earned-detail-v6030"><div><span class="eyebrow">Billing cycle</span><h3>Only completed work is invoiced</h3></div>${stripFor(selectedInvoice)}${selectedInvoice.billingMissingVisitWarningV59383?`<p>${esc(selectedInvoice.billingMissingVisitWarningV59383)}</p>`:''}</section>`);
    }

    const eyebrow=document.querySelector('#view-invoices .billing-heading-v58952 .eyebrow');if(eyebrow)eyebrow.textContent='Completed-work billing';
    document.documentElement.dataset.billingModel='completed-work-v6030';
  }

  const renderBase=window.renderInvoiceCentre;
  if(typeof renderBase==='function'){
    window.renderInvoiceCentre=function renderInvoiceCentreV6031(){
      chooseInitialBillingStageV6031();
      reconcileAll({save:false});
      const result=renderBase.apply(this,arguments);
      queueMicrotask(applyUi);
      return result;
    };
  }

  const persistBase=window.persistRoutineBillingV59664;
  if(typeof persistBase==='function'){
    window.persistRoutineBillingV59664=async function persistRoutineBillingV6031(options={}){
      const result=await persistBase(options);
      const earned=reconcileAll({save:false});
      return {...(result||{}),completedWorkBillingChangedV6030:earned.changed};
    };
  }

  const sendBase=window.openCommercialSendV59400;
  if(typeof sendBase==='function'){
    window.openCommercialSendV59400=function openCommercialSendV6031(type,id){
      if(type==='invoice'){
        const invoice=invoiceFor(id);
        if(routineDraft(invoice)){
          reconcileInvoice(invoice);
          const cycle=bounds(invoice),sendDate=dateOnly(invoice.invoiceByDate||invoice.availableToIssueDateV59383||invoice.invoiceCycleDateV59383||invoice.issueDate);
          if(sendDate&&today()<sendDate){window.toast?.(`This routine invoice is scheduled for ${fmt(sendDate)}.`,'error');return;}
          if(Number(invoice.routineExpectedVisitCountV59660||0)<=0){window.toast?.('Confirm this client’s recurring schedule before invoicing.','error');return;}
          if(Number(invoice.routineBillableVisitCountV6030||0)<=0||invoiceTotal(invoice)<=0){window.toast?.('There is no completed routine work to invoice for this billing cycle.','error');return;}
          const client=clientFor(invoice.clientId),price=pricing(client,invoice),rate=price.mode==='monthly_fixed'?price.monthly:price.perVisit;
          if(rate<=0){window.toast?.('Enter the agreed client rate before issuing this invoice.','error');return;}
        }
      }
      return sendBase.apply(this,arguments);
    };
  }

  const previewBase=window.previewInvoice;
  if(typeof previewBase==='function'){
    window.previewInvoice=function previewInvoiceV6031(id){const invoice=invoiceFor(id);if(routineDraft(invoice))reconcileInvoice(invoice);return previewBase.apply(this,arguments);};
  }

  function boot(){
    reconcileAll({save:false});
    if(document.getElementById('view-invoices')&&!document.getElementById('view-invoices').classList.contains('hidden'))queueMicrotask(applyUi);
    window.__tuinbooksCompletedWorkBillingV6031={build:BUILD,reconcile:()=>{const result=reconcileAll({save:false});try{window.renderInvoiceCentre?.();}catch{}return result;},invoiceSummary:id=>{const invoice=invoiceFor(id);if(!invoice)return null;reconcileInvoice(invoice);return {expected:invoice.routineExpectedValueV6030,completed:invoice.routineCompletedValueV6030,missed:invoice.routineMissedValueV6030,invoice:invoice.routineInvoiceableValueV6030,billableVisits:invoice.routineBillableVisitCountV6030,excludedCarryover:invoice.routineExcludedCarryoverCountV6030};},rateCoverage:rateCoverageV6031};
    const marker=document.querySelector('[id^="tuinbooksBuildV"]');if(marker){marker.id='tuinbooksBuildV6031';marker.textContent='v60.3.1';marker.title='TuinBooks completed-work billing + navigation/rate recovery';}
    window.__tuinbooksBuild=BUILD;window.__tuinbooksBillingBuild=BUILD;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
